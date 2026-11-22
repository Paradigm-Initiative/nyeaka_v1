import { prisma } from "@/neon-db";
import { appUrl } from "./app-url";
import { sendEmail } from "./email";
import { countryName } from "./countries";
import { ageOf } from "./admin-format";
import { staleQueueEmail, weeklySummaryEmail } from "./email-templates";

// Staff-facing review alerts. English only. Run from protected cron routes (lib/cron-auth.ts).

/** An ID case should be decided within this many hours. */
export const REVIEW_TARGET_HOURS = 36;
const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

/**
 * Who gets these emails: every admin (not suspended or deleted) plus the extra addresses in
 * REVIEW_ALERT_EMAILS (comma separated, for example a manager). De-duplicated, case-insensitive.
 */
export async function reviewRecipients(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { staffRole: "ADMIN", suspendedAt: null, deletedAt: null },
    select: { email: true },
  });
  const extra = (process.env.REVIEW_ALERT_EMAILS ?? "").split(",");
  const all = [...admins.map((a) => a.email), ...extra].map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
  return [...new Set(all)];
}

async function sendAll(recipients: string[], mail: { subject: string; html: string }, label: string): Promise<boolean> {
  const results = await Promise.allSettled(recipients.map((to) => sendEmail({ to, ...mail })));
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((f) => console.error(`${label}: email failed`, (f as PromiseRejectedResult).reason));
  return failed.length < recipients.length; // delivered to at least one person
}

/** Cases waiting past the target that haven't been alerted yet. A reopened case waits from its reopen. */
const staleWhere = (now: Date) => {
  const cutoff = new Date(now.getTime() - REVIEW_TARGET_HOURS * HOUR);
  return {
    status: "PENDING" as const,
    staleAlertedAt: null,
    OR: [{ overturnedAt: null, createdAt: { lte: cutoff } }, { overturnedAt: { lte: cutoff } }],
  };
};

export type StaleAlertResult = { alerted: number; emailed: boolean };

/**
 * Email once about each case that has waited past the target. A case is marked alerted
 * (one conditional update, so overlapping runs can't both alert it) BEFORE the email goes
 * out, and the mark is undone if nobody could be emailed, so a mail problem delays the alert
 * instead of losing it. With nobody to email, nothing is marked.
 */
export async function sendStaleQueueAlert(now = new Date()): Promise<StaleAlertResult> {
  const candidates = await prisma.idVerification.findMany({
    where: staleWhere(now),
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidates.length) return { alerted: 0, emailed: false };

  const recipients = await reviewRecipients();
  if (!recipients.length) {
    console.warn("review alerts: no admins and REVIEW_ALERT_EMAILS is not set, so nobody was emailed");
    return { alerted: 0, emailed: false };
  }

  const claimed: string[] = [];
  for (const c of candidates) {
    const done = await prisma.idVerification.updateMany({ where: { id: c.id, ...staleWhere(now) }, data: { staleAlertedAt: now } });
    if (done.count === 1) claimed.push(c.id);
  }
  if (!claimed.length) return { alerted: 0, emailed: false };

  const rows = await prisma.idVerification.findMany({
    where: { id: { in: claimed } },
    orderBy: { createdAt: "asc" },
    select: { countryCode: true, createdAt: true, overturnedAt: true, user: { select: { name: true } } },
  });
  const mail = staleQueueEmail({
    cases: rows.map((r) => ({ name: r.user.name, country: countryName(r.countryCode, "en"), waiting: ageOf(r.overturnedAt ?? r.createdAt, now.getTime()) })),
    targetHours: REVIEW_TARGET_HOURS,
    url: appUrl("/admin/verifications"),
  });
  const sent = await sendAll(recipients, mail, "stale review alert");
  if (!sent) await prisma.idVerification.updateMany({ where: { id: { in: claimed }, staleAlertedAt: now }, data: { staleAlertedAt: null } });
  return { alerted: sent ? claimed.length : 0, emailed: sent };
}

export type WeeklySummary = {
  received: number; decided: number; approved: number; rejected: number;
  waiting: number; oldestWaiting: string | null; overTarget: number;
};

/** The numbers for the week ending at `now`. */
export async function weeklySummaryData(now = new Date()): Promise<WeeklySummary> {
  const since = new Date(now.getTime() - WEEK);
  const overCutoff = new Date(now.getTime() - REVIEW_TARGET_HOURS * HOUR);
  const pending = await prisma.idVerification.findMany({
    where: { status: "PENDING" },
    select: { createdAt: true, overturnedAt: true },
  });
  const waitingSince = pending.map((p) => (p.overturnedAt ?? p.createdAt).getTime());
  const oldest = waitingSince.length ? Math.min(...waitingSince) : null;
  const [received, approved, rejected] = await Promise.all([
    prisma.idVerification.count({ where: { createdAt: { gte: since, lte: now } } }),
    // Human decisions only (the sweep that closes unreviewed cases isn't one).
    prisma.idVerification.count({ where: { status: "VERIFIED", reviewedById: { not: null }, decidedAt: { gte: since, lte: now } } }),
    prisma.idVerification.count({ where: { status: "FAILED", reviewedById: { not: null }, decidedAt: { gte: since, lte: now } } }),
  ]);
  return {
    received, approved, rejected, decided: approved + rejected,
    waiting: pending.length,
    oldestWaiting: oldest === null ? null : ageOf(new Date(oldest), now.getTime()),
    overTarget: waitingSince.filter((t) => t <= overCutoff.getTime()).length,
  };
}

export async function sendWeeklySummary(now = new Date()): Promise<{ emailed: boolean; summary: WeeklySummary }> {
  const summary = await weeklySummaryData(now);
  const recipients = await reviewRecipients();
  if (!recipients.length) {
    console.warn("review summary: no admins and REVIEW_ALERT_EMAILS is not set, so nobody was emailed");
    return { emailed: false, summary };
  }
  const mail = weeklySummaryEmail({ ...summary, targetHours: REVIEW_TARGET_HOURS, url: appUrl("/admin/verifications") });
  return { emailed: await sendAll(recipients, mail, "weekly review summary"), summary };
}

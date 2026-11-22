import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});
const sendEmail = vi.hoisted(() => vi.fn<(m: { to: string; subject: string; html: string }) => Promise<string>>());
vi.mock("@/lib/email", () => ({ sendEmail }));

import { prisma as _prisma } from "@/neon-db";
import { REVIEW_TARGET_HOURS, reviewRecipients, sendStaleQueueAlert, sendWeeklySummary, weeklySummaryData } from "@/lib/review-alerts";
import { weeklySummaryEmail } from "@/lib/email-templates";
import { GET as alertsGET, POST as alertsPOST } from "@/app/api/cron/review-alerts/route";
import { GET as summaryGET } from "@/app/api/cron/review-summary/route";
import { GET as purgeGET } from "@/app/api/cron/purge/route";

const prisma = _prisma as unknown as PrismaClient;
const HOUR = 3_600_000;
const NOW = new Date("2026-12-07T08:00:00Z");

let n = 0;
const user = (extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `u${++n}@t.test`, firstName: "u", lastName: "T", name: `Person ${n}`, countryCode: "GH", ...extra } });
const admin = (email?: string, extra: Record<string, unknown> = {}) => user({ staffRole: "ADMIN", twoFactorEnabled: true, ...(email ? { email } : {}), ...extra });
const idCase = async (hoursAgo: number, extra: Record<string, unknown> = {}) => {
  const u = await user();
  return prisma.idVerification.create({
    data: { userId: u.id, countryCode: "GH", documentType: "NATIONAL_ID", fullNameOnId: "x", frontKey: `id/${u.id}/f.jpg`, selfieKey: `id/${u.id}/s.jpg`, createdAt: new Date(NOW.getTime() - hoursAgo * HOUR), ...extra } as never,
  });
};
const mails = () => sendEmail.mock.calls.map((c) => c[0]);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
  sendEmail.mockReset();
  sendEmail.mockResolvedValue("id");
  delete process.env.REVIEW_ALERT_EMAILS;
});
afterAll(() => testDb.stop());

describe("recipients", () => {
  it("are the admins plus REVIEW_ALERT_EMAILS, de-duplicated, without suspended admins or reviewers", async () => {
    await admin("a1@pin.org");
    await admin("a2@pin.org", { suspendedAt: new Date() });
    await user({ staffRole: "REVIEWER", email: "rev@pin.org" });
    process.env.REVIEW_ALERT_EMAILS = " Manager@pin.org, A1@PIN.org ,, not-an-email ";
    expect((await reviewRecipients()).sort()).toEqual(["a1@pin.org", "manager@pin.org"]);
  });
});

describe("36-hour alert", () => {
  it("alerts only cases waiting past the target, once per case, in one email to everyone", async () => {
    await admin("a1@pin.org");
    process.env.REVIEW_ALERT_EMAILS = "manager@pin.org";
    const old = await idCase(REVIEW_TARGET_HOURS + 2);
    await idCase(REVIEW_TARGET_HOURS - 2); // not stale yet
    await idCase(100, { status: "VERIFIED", decidedAt: NOW }); // decided: ignored

    expect(await sendStaleQueueAlert(NOW)).toEqual({ alerted: 1, emailed: true });
    expect(mails().map((m) => m.to).sort()).toEqual(["a1@pin.org", "manager@pin.org"]);
    expect(mails()[0].subject).toBe("[Nyeaka] 1 ID review waiting over 36 hours");
    expect(mails()[0].html).toContain("waiting 1 d");
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: old.id } })).staleAlertedAt).toEqual(NOW);

    // the daily run again: the same case is not emailed twice
    sendEmail.mockClear();
    expect(await sendStaleQueueAlert(new Date(NOW.getTime() + 24 * HOUR))).toMatchObject({ alerted: 1 }); // only the second case is newly stale
    expect(mails()[0].subject).toBe("[Nyeaka] 1 ID review waiting over 36 hours");
    expect(mails()[0].html).toContain("waiting 2 d");
    sendEmail.mockClear();
    expect(await sendStaleQueueAlert(new Date(NOW.getTime() + 48 * HOUR))).toEqual({ alerted: 0, emailed: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("two runs at once alert a case only once", async () => {
    await admin("a1@pin.org");
    await idCase(50);
    const [r1, r2] = await Promise.all([sendStaleQueueAlert(NOW), sendStaleQueueAlert(NOW)]);
    expect(r1.alerted + r2.alerted).toBe(1);
    expect(mails()).toHaveLength(1);
  });

  it("with nobody to email, nothing is marked, so the alert isn't lost", async () => {
    const c = await idCase(50);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendStaleQueueAlert(NOW)).toEqual({ alerted: 0, emailed: false });
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: c.id } })).staleAlertedAt).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("REVIEW_ALERT_EMAILS"));
    warn.mockRestore();
    await admin("a1@pin.org");
    expect(await sendStaleQueueAlert(NOW)).toMatchObject({ alerted: 1 });
  });

  it("if every email fails the mark is undone and the next run tries again", async () => {
    await admin("a1@pin.org");
    const c = await idCase(50);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockRejectedValue(new Error("mail down"));
    expect(await sendStaleQueueAlert(NOW)).toEqual({ alerted: 0, emailed: false });
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: c.id } })).staleAlertedAt).toBeNull();
    sendEmail.mockResolvedValue("id");
    expect(await sendStaleQueueAlert(NOW)).toEqual({ alerted: 1, emailed: true });
    err.mockRestore();
  });

  it("a reopened case waits from the reopen, and is alerted again after it is overturned", async () => {
    await admin("a1@pin.org");
    const c = await idCase(200, { overturnedAt: new Date(NOW.getTime() - 5 * HOUR) });
    expect(await sendStaleQueueAlert(NOW)).toEqual({ alerted: 0, emailed: false }); // old submission, but only 5h since reopen
    await prisma.idVerification.update({ where: { id: c.id }, data: { overturnedAt: new Date(NOW.getTime() - 40 * HOUR) } });
    expect(await sendStaleQueueAlert(NOW)).toMatchObject({ alerted: 1 });
  });

  it("overturning clears the alert mark so a reopened case can be alerted again", async () => {
    const { overturnVerification } = await import("@/lib/verification-audit");
    const adm = await admin("a1@pin.org");
    const c = await idCase(50, { status: "VERIFIED", reviewedById: adm.id, decidedAt: NOW, staleAlertedAt: NOW, imagesPurgeAt: NOW });
    await prisma.user.update({ where: { id: (await prisma.idVerification.findUniqueOrThrow({ where: { id: c.id } })).userId }, data: { idVerificationStatus: "VERIFIED" } });
    const other = await admin("a2@pin.org");
    await overturnVerification(other.id, c.id, "reopen please");
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: c.id } })).staleAlertedAt).toBeNull();
  });
});

describe("weekly summary", () => {
  it("counts what came in, what was decided, who is waiting and what is over target", async () => {
    await admin("a1@pin.org");
    const adm = await prisma.user.findFirstOrThrow({ where: { staffRole: "ADMIN" } });
    await idCase(24 * 2, { status: "VERIFIED", reviewedById: adm.id, decidedAt: new Date(NOW.getTime() - 24 * HOUR) });
    await idCase(24 * 3, { status: "FAILED", reviewedById: adm.id, decidedAt: new Date(NOW.getTime() - 48 * HOUR) });
    await idCase(24 * 20, { status: "VERIFIED", reviewedById: adm.id, decidedAt: new Date(NOW.getTime() - 24 * 10 * HOUR) }); // last month
    await idCase(24 * 4, { status: "FAILED", rejectionReason: "swept", decidedAt: NOW }); // closed by the sweep: not a human decision
    await idCase(10); // waiting, under target
    await idCase(60); // waiting, over target
    expect(await weeklySummaryData(NOW)).toEqual({
      received: 5, decided: 2, approved: 1, rejected: 1, waiting: 2, oldestWaiting: "2 d", overTarget: 1,
    });
  });

  it("is a plain-English email to every recipient", async () => {
    await admin("a1@pin.org");
    process.env.REVIEW_ALERT_EMAILS = "manager@pin.org";
    await idCase(60);
    const r = await sendWeeklySummary(NOW);
    expect(r.emailed).toBe(true);
    expect(mails().map((m) => m.to).sort()).toEqual(["a1@pin.org", "manager@pin.org"]);
    expect(mails()[0].subject).toBe("[Nyeaka] Weekly ID review summary");
    expect(mails()[0].html).toContain("1 person sent in ID documents this week.");
    expect(mails()[0].html).toContain("1 has waited more than our 36-hour target.");
  });

  it("wording handles zero and plural", () => {
    const quiet = weeklySummaryEmail({ received: 0, decided: 0, approved: 0, rejected: 0, waiting: 0, oldestWaiting: null, overTarget: 0, targetHours: 36, url: "https://x.test" });
    expect(quiet.html).toContain("Nothing is waiting for review right now.");
    expect(quiet.html).toContain("No case has waited more than 36 hours.");
    const busy = weeklySummaryEmail({ received: 3, decided: 2, approved: 2, rejected: 0, waiting: 4, oldestWaiting: "3 d", overTarget: 2, targetHours: 36, url: "https://x.test" });
    expect(busy.html).toContain("3 people sent in ID documents");
    expect(busy.html).toContain("4 are waiting for review right now. The longest wait is 3 d.");
    expect(busy.html).toContain("2 have waited more than our 36-hour target.");
  });

  it("with nobody to email it says so and sends nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await sendWeeklySummary(NOW)).emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("cron routes", () => {
  const req = (path: string, auth?: string, method = "GET") =>
    new Request(`http://localhost/api/cron/${path}`, { method, headers: auth ? { authorization: auth } : {} });

  it("refuse everything without CRON_SECRET, and a missing or wrong token", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await alertsGET(req("review-alerts", "Bearer "))).status).toBe(503);
    expect((await summaryGET(req("review-summary"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret-value-123");
    for (const h of [undefined, "Bearer nope", "s3cret-value-123"]) {
      expect((await alertsGET(req("review-alerts", h))).status).toBe(401);
      expect((await summaryGET(req("review-summary", h))).status).toBe(401);
    }
    expect(sendEmail).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("run with the right token, on GET and POST, and the purge route still works through the shared wrapper", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value-123");
    await admin("a1@pin.org");
    await idCase(100, { createdAt: new Date(Date.now() - 100 * HOUR) });
    const res = await alertsGET(req("review-alerts", "Bearer s3cret-value-123"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alerted: 1, emailed: true });
    expect((await alertsPOST(req("review-alerts", "Bearer s3cret-value-123", "POST"))).status).toBe(200);
    const s = await summaryGET(req("review-summary", "Bearer s3cret-value-123"));
    expect(s.status).toBe(200);
    expect((await s.json()).emailed).toBe(true);
    expect((await purgeGET(req("purge", "Bearer nope"))).status).toBe(401);
    vi.unstubAllEnvs();
  });

  it("the schedule is in vercel.json", async () => {
    const fs = await import("node:fs");
    const crons = JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons as { path: string; schedule: string }[];
    expect(crons).toContainEqual({ path: "/api/cron/review-alerts", schedule: "0 8 * * *" });
    expect(crons).toContainEqual({ path: "/api/cron/review-summary", schedule: "0 8 * * 1" });
    expect(crons.some((c) => c.path === "/api/cron/purge")).toBe(true);
  });
});

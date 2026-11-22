import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertAdminOnly, logAdminAction } from "./admin";
import { ABANDONED_REASON } from "./purge";

// The audit side of ID decisions: who decided what, how fast, and overturning a decision.
// Admin only, English only.

export const DECISIONS_PAGE_SIZE = 50;
const DAY_MS = 86_400_000;

export type DecisionFilter = { reviewerId?: string; outcome?: "VERIFIED" | "FAILED"; from?: Date; to?: Date; page?: number };

function decisionWhere(f: DecisionFilter, withReviewer = true) {
  return {
    // Human decisions only: the sweep that closes unreviewed cases is not a reviewer's decision.
    reviewedById: withReviewer && f.reviewerId ? f.reviewerId : { not: null },
    status: f.outcome ?? { in: ["VERIFIED", "FAILED"] as ("VERIFIED" | "FAILED")[] },
    decidedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}), not: null },
  };
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Every decision, newest first, with filters. Past the 30-day mark the images are gone and only this metadata remains. */
export async function listDecisions(adminId: string, f: DecisionFilter = {}) {
  await assertAdminOnly(adminId);
  const page = Math.max(1, f.page ?? 1);
  const where = decisionWhere(f);
  const [total, rows, reviewers] = await Promise.all([
    prisma.idVerification.count({ where }),
    prisma.idVerification.findMany({
      where,
      orderBy: { decidedAt: "desc" },
      skip: (page - 1) * DECISIONS_PAGE_SIZE,
      take: DECISIONS_PAGE_SIZE,
      select: {
        id: true, status: true, countryCode: true, documentType: true, rejectionCode: true, createdAt: true, decidedAt: true,
        overturnedAt: true, imagesPurgedAt: true, imagesPurgeAt: true,
        firstDecisionBy: { select: { name: true } },
        user: { select: { name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({ where: { staffRole: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / DECISIONS_PAGE_SIZE)), reviewers };
}

/** Per reviewer, for the same outcome and date filters: how many, the approve rate, and the median wait until decided. */
export async function reviewerStats(adminId: string, f: Omit<DecisionFilter, "reviewerId" | "page"> = {}) {
  await assertAdminOnly(adminId);
  const rows = await prisma.idVerification.findMany({
    where: decisionWhere(f, false),
    orderBy: { decidedAt: "desc" },
    take: 5000, // plenty for a reporting window; the date filter narrows it further
    select: { status: true, createdAt: true, decidedAt: true, overturnedAt: true, reviewedBy: { select: { id: true, name: true } } },
  });
  const by = new Map<string, { id: string; name: string; approved: number; rejected: number; waits: number[] }>();
  for (const r of rows) {
    if (!r.reviewedBy || !r.decidedAt) continue;
    const s = by.get(r.reviewedBy.id) ?? { id: r.reviewedBy.id, name: r.reviewedBy.name, approved: 0, rejected: 0, waits: [] };
    if (r.status === "VERIFIED") s.approved++; else s.rejected++;
    // From when it started waiting (reopened cases count from the reopen) to the decision.
    s.waits.push(r.decidedAt.getTime() - (r.overturnedAt ?? r.createdAt).getTime());
    by.set(s.id, s);
  }
  return [...by.values()]
    .map((s) => {
      const count = s.approved + s.rejected;
      return { id: s.id, name: s.name, count, approved: s.approved, rejected: s.rejected, approveRate: count ? s.approved / count : 0, medianWaitMs: median(s.waits) };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Send a decided case back to PENDING with a note, reset the person's status and log it.
 * - Images still stored: the retention clock is cleared (they stay for the re-review) and
 *   a fresh 30-day clock starts at the new decision.
 * - Images already purged: there is nothing to re-review, so the case does not reopen; the
 *   person's status goes back to NONE and they submit again.
 * Only the person's most recent submission can be overturned (one case waits at a time).
 * Not for your own submission, nor for cases the not-reviewed-in-time sweep closed.
 */
export async function overturnVerification(adminId: string, id: string, note: string) {
  await assertAdminOnly(adminId);
  const why = note.trim().slice(0, 500);
  if (why.length < 3) throw new ServiceError("INVALID", "A note explaining the overturn is required.");
  return prisma.$transaction(async (tx) => {
    const row = await tx.idVerification.findUnique({
      where: { id },
      select: { userId: true, status: true, reviewedById: true, rejectionReason: true, imagesPurgedAt: true },
    });
    if (!row) throw new ServiceError("NOT_FOUND", "Verification not found.");
    if (row.userId === adminId) throw new ServiceError("FORBIDDEN", "You can't overturn a decision on your own verification.");
    if (row.status === "PENDING") throw new ServiceError("INVALID", "This case is already waiting for a decision.");
    if (row.status === "NONE" || (row.status === "FAILED" && row.rejectionReason === ABANDONED_REASON))
      throw new ServiceError("INVALID", "This case was closed because nobody reviewed it in time. There is no decision to overturn.");
    const latest = await tx.idVerification.findFirst({ where: { userId: row.userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (latest?.id !== id) throw new ServiceError("INVALID", "Only the person's most recent submission can be overturned.");

    const now = new Date();
    const reopen = !row.imagesPurgedAt;
    const mark = { overturnedAt: now, overturnedById: adminId, overturnNote: why };
    // Conditional on the status we read, so two admins overturning together can't both apply.
    const done = await tx.idVerification.updateMany({
      where: { id, status: row.status },
      data: reopen
        ? {
            ...mark, status: "PENDING", reviewedById: null, decidedAt: null, rejectionCode: null, rejectionReason: null,
            imagesPurgeAt: null, claimedById: null, claimedAt: null,
            firstDecisionById: null, firstDecisionAt: null, firstOutcome: null, firstRejectionCode: null,
          }
        : mark,
    });
    if (done.count === 0) throw new ServiceError("INVALID", "This decision was just changed. Reload to see it.");
    await tx.user.update({ where: { id: row.userId }, data: { idVerificationStatus: reopen ? "PENDING" : "NONE" } });
    await logAdminAction(tx, {
      actorId: adminId, action: "id.overturn", targetType: "IdVerification", targetId: id, reason: why,
      meta: { userId: row.userId, previousStatus: row.status, previousReviewerId: row.reviewedById, reopened: reopen },
    });
    return { reopened: reopen };
  });
}

export const waitText = (ms: number | null) => {
  if (ms === null) return "n/a";
  const h = ms / 3_600_000;
  return h < 1 ? `${Math.round(ms / 60_000)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(ms / DAY_MS).toFixed(1)} d`;
};

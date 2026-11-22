import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertStaff } from "./admin";

// Who is looking at which ID case. English only. Opening a case claims it; the claim lapses
// after 15 minutes without activity. Lapsing is decided by comparing timestamps when the row
// is read or written, so nothing needs a scheduled job.

export const CLAIM_TTL_MS = 15 * 60_000;

export const SECOND_REVIEWER = "You made the first decision on this case. A different reviewer must decide it.";
export const OWN_CASE = "You can't review your own verification.";
const ALREADY_DECIDED = "This submission has already been decided.";

export const claimCutoff = (now: Date) => new Date(now.getTime() - CLAIM_TTL_MS);

/** Prisma where-fragment: nobody else holds a live claim (free, mine, or lapsed). */
export const claimFreeFor = (adminId: string, now: Date) => ({
  OR: [{ claimedById: null }, { claimedById: adminId }, { claimedAt: { lte: claimCutoff(now) } }],
});

/** Is this claim live, and whose? For lists and the review page. */
export function claimState(row: { claimedById: string | null; claimedAt: Date | null; claimedBy?: { name: string } | null }, me: string, now = new Date()) {
  const live = !!row.claimedById && !!row.claimedAt && row.claimedAt > claimCutoff(now);
  return {
    live,
    mine: live && row.claimedById === me,
    byOther: live && row.claimedById !== me,
    byName: live ? (row.claimedBy?.name ?? null) : null,
    expiresAt: live && row.claimedAt ? new Date(row.claimedAt.getTime() + CLAIM_TTL_MS) : null,
  };
}

/** Why a conditional update on a case matched nothing, as a message for the reviewer. */
export async function whyBlocked(adminId: string, id: string, now = new Date()): Promise<ServiceError> {
  const r = await prisma.idVerification.findUnique({
    where: { id },
    select: { status: true, claimedById: true, claimedAt: true, claimedBy: { select: { name: true } }, firstDecisionById: true },
  });
  if (!r) return new ServiceError("NOT_FOUND", "Verification not found.");
  if (r.status !== "PENDING") return new ServiceError("INVALID", ALREADY_DECIDED);
  const c = claimState(r, adminId, now);
  if (c.byOther) return new ServiceError("INVALID", `${c.byName ?? "Another reviewer"} is reviewing this case. Their claim lapses after 15 minutes of inactivity.`);
  if (r.firstDecisionById && r.firstDecisionById !== adminId)
    return new ServiceError("INVALID", "Another reviewer has just recorded the first decision. Reload to give the second.");
  return new ServiceError("INVALID", ALREADY_DECIDED);
}

/**
 * Claim a case (opening it does this; viewing its images and deciding it refresh or take
 * the claim too). One conditional update, so two reviewers opening it together can't both
 * hold it. Refused for your own submission and for a case you gave the first decision on.
 */
export async function claimVerification(adminId: string, id: string) {
  await assertStaff(adminId);
  const now = new Date();
  const row = await prisma.idVerification.findUnique({ where: { id }, select: { userId: true, firstDecisionById: true } });
  if (!row) throw new ServiceError("NOT_FOUND", "Verification not found.");
  if (row.userId === adminId) throw new ServiceError("FORBIDDEN", OWN_CASE);
  if (row.firstDecisionById === adminId) throw new ServiceError("FORBIDDEN", SECOND_REVIEWER);
  const done = await prisma.idVerification.updateMany({
    where: { id, status: "PENDING", ...claimFreeFor(adminId, now) },
    data: { claimedById: adminId, claimedAt: now },
  });
  if (done.count === 0) throw await whyBlocked(adminId, id, now);
  return { expiresAt: new Date(now.getTime() + CLAIM_TTL_MS) };
}

/** Give a case back to the queue. Only the holder can; releasing one you don't hold does nothing. */
export async function releaseVerification(adminId: string, id: string) {
  await assertStaff(adminId);
  await prisma.idVerification.updateMany({ where: { id, claimedById: adminId }, data: { claimedById: null, claimedAt: null } });
}

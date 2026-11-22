import { prisma } from "@/neon-db";
import { deleteIdObjects } from "./storage-private";
import { IMAGE_RETENTION_DAYS } from "./verification";

const DAY_MS = 86_400_000;
const CHUNK = 100;
/** Per run, so one invocation stays well inside a serverless time limit. The next run continues. */
const MAX_ROWS_PER_RUN = 1000;

export const ABANDONED_REASON = "Not reviewed in time. Please submit again.";

export type PurgeResult = { abandoned: number; purged: number; objects: number; hashesExpired: number };

/**
 * A submission nobody reviewed within the retention window is closed (FAILED, so the
 * person can submit again) and its images are scheduled for deletion right away.
 */
async function closeAbandoned(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - IMAGE_RETENTION_DAYS * DAY_MS);
  return prisma.$transaction(async (tx) => {
    const stale = await tx.idVerification.findMany({
      // A reopened (overturned) case counts from when it was reopened, not from its first submission.
      where: { status: "PENDING", OR: [{ overturnedAt: null, createdAt: { lt: cutoff } }, { overturnedAt: { lt: cutoff } }] },
      select: { id: true, userId: true },
    });
    if (!stale.length) return 0;
    // Re-check PENDING in the update, so a review that lands in between wins.
    const closed = await tx.idVerification.updateMany({
      where: { id: { in: stale.map((s) => s.id) }, status: "PENDING" },
      data: { status: "FAILED", rejectionReason: ABANDONED_REASON, decidedAt: now, imagesPurgeAt: now },
    });
    await tx.user.updateMany({
      where: { id: { in: stale.map((s) => s.userId) }, idVerificationStatus: "PENDING" },
      data: { idVerificationStatus: "FAILED" },
    });
    return closed.count;
  });
}

/**
 * Delete ID images whose time is up and null their keys. Safe to run any number of times,
 * at any frequency, and to retry after a failure: objects are deleted BEFORE the keys are
 * cleared, a missing object is not an error, and rows already purged are never selected.
 */
async function purgeExpiredImages(now: Date): Promise<{ purged: number; objects: number }> {
  let purged = 0;
  let objects = 0;
  while (purged < MAX_ROWS_PER_RUN) {
    const rows = await prisma.idVerification.findMany({
      where: { imagesPurgedAt: null, imagesPurgeAt: { lte: now } },
      orderBy: { imagesPurgeAt: "asc" },
      take: CHUNK,
      select: { id: true, frontKey: true, backKey: true, selfieKey: true },
    });
    if (!rows.length) break;

    const keys = rows.flatMap((r) => [r.frontKey, r.backKey, r.selfieKey]).filter((k): k is string => !!k);
    if (keys.length) await deleteIdObjects(keys); // throws on failure: nothing below runs, the next run retries
    await prisma.idVerification.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, imagesPurgedAt: null },
      data: { frontKey: null, backKey: null, selfieKey: null, imagesPurgedAt: now },
    });
    purged += rows.length;
    objects += keys.length;
  }
  return { purged, objects };
}

/** Suspended people's document hashes are only kept for 12 months (see lib/moderation.ts). */
async function expireBlockedDocuments(now: Date): Promise<number> {
  return (await prisma.blockedDocument.deleteMany({ where: { expiresAt: { lte: now } } })).count;
}

export async function runPurge(now = new Date()): Promise<PurgeResult> {
  const abandoned = await closeAbandoned(now);
  const images = await purgeExpiredImages(now);
  return { abandoned, ...images, hashesExpired: await expireBlockedDocuments(now) };
}

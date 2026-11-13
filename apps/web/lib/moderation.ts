import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertAdmin, logAdminAction } from "./admin";
import { liftRestriction } from "./safety";
import { cancelAllActiveMatchesOf } from "./matches";

// The admin side of reports: dismiss, close a post, suspend a person. English only.
// Each function asserts the caller is an admin and writes to the activity log in the
// same transaction as the change.

/** How long a suspended person's document hash is remembered. */
export const HASH_RETENTION_MONTHS = 12;
const PAGE_SIZE = 50;

export async function listOpenReports(adminId: string, page = 1) {
  await assertAdmin(adminId);
  const where = { status: "OPEN" as const };
  const [total, rows] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, targetType: true, reason: true, details: true, createdAt: true,
        reporter: { select: { name: true } },
        reportedUser: { select: { id: true, name: true, role: true, restrictedAt: true, suspendedAt: true, deletedAt: true } },
        targetListing: { select: { id: true, title: true, status: true } },
        targetRequest: { select: { id: true, title: true, status: true } },
        targetMessage: { select: { body: true } },
      },
    }),
  ]);
  // How many different people have an open report against each person on this page.
  const ids = [...new Set(rows.map((r) => r.reportedUser.id))];
  const open = ids.length
    ? await prisma.report.findMany({ where: { reportedUserId: { in: ids }, status: "OPEN" }, distinct: ["reportedUserId", "reporterId"], select: { reportedUserId: true } })
    : [];
  const counts = new Map<string, number>();
  for (const o of open) counts.set(o.reportedUserId, (counts.get(o.reportedUserId) ?? 0) + 1);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, reporters: counts.get(r.reportedUser.id) ?? 1 })),
  };
}

async function openReport(reportId: string) {
  const r = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, reportedUserId: true, targetListingId: true, targetRequestId: true },
  });
  if (!r) throw new ServiceError("NOT_FOUND", "Report not found.");
  if (r.status !== "OPEN") throw new ServiceError("INVALID", "This report has already been handled.");
  return r;
}

/** The report was unfounded. Dismissed reports stop counting towards a restriction. */
export async function dismissReport(adminId: string, reportId: string, note?: string) {
  await assertAdmin(adminId);
  const r = await openReport(reportId);
  await prisma.$transaction(async (tx) => {
    const done = await tx.report.updateMany({ where: { id: reportId, status: "OPEN" }, data: { status: "DISMISSED" } });
    if (done.count === 0) throw new ServiceError("INVALID", "This report has already been handled.");
    await logAdminAction(tx, {
      actorId: adminId, action: "report.dismiss", targetType: "Report", targetId: reportId,
      reason: note?.trim() || undefined, meta: { reportedUserId: r.reportedUserId },
    });
  });
}

/** Take the reported listing or request down (it can be renewed by its owner only if they are not suspended). */
export async function closeReportedPost(adminId: string, reportId: string) {
  await assertAdmin(adminId);
  const r = await openReport(reportId);
  if (!r.targetListingId && !r.targetRequestId)
    throw new ServiceError("INVALID", "This report is not about a listing or request.");
  await prisma.$transaction(async (tx) => {
    const done = await tx.report.updateMany({ where: { id: reportId, status: "OPEN" }, data: { status: "ACTIONED" } });
    if (done.count === 0) throw new ServiceError("INVALID", "This report has already been handled.");
    if (r.targetListingId) await tx.listing.updateMany({ where: { id: r.targetListingId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    if (r.targetRequestId) await tx.request.updateMany({ where: { id: r.targetRequestId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    await logAdminAction(tx, {
      actorId: adminId, action: "report.close_post", targetType: "Report", targetId: reportId,
      meta: { listingId: r.targetListingId, requestId: r.targetRequestId, reportedUserId: r.reportedUserId },
    });
  });
}

/**
 * Suspend a person: they are signed out and can't sign in, their live posts close, their
 * active matches are cancelled (freeing the other side's posts), their pending offers are
 * declined, their ID-document hashes are kept for 12 months so the same document can't
 * verify a new account, and every open report against them is marked actioned.
 */
export async function suspendUser(adminId: string, userId: string, reason: string) {
  await assertAdmin(adminId);
  const why = reason.trim();
  if (why.length < 3) throw new ServiceError("INVALID", "A reason is required.");
  if (userId === adminId) throw new ServiceError("FORBIDDEN", "You can't suspend yourself.");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, suspendedAt: true, deletedAt: true } });
  if (!u || u.deletedAt) throw new ServiceError("NOT_FOUND", "User not found.");
  if (u.role === "ADMIN") throw new ServiceError("FORBIDDEN", "Admins can't be suspended. Change their role first.");
  if (u.suspendedAt) throw new ServiceError("INVALID", "This person is already suspended.");

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + HASH_RETENTION_MONTHS);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { suspendedAt: now, suspendedReason: why.slice(0, 500) } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.listing.updateMany({ where: { donorId: userId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    await tx.request.updateMany({ where: { requesterId: userId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    await cancelAllActiveMatchesOf(tx, userId);
    await tx.offer.updateMany({
      where: { status: "PENDING", OR: [{ donorId: userId }, { request: { requesterId: userId } }] },
      data: { status: "DECLINED" },
    });
    await retainDocumentHashes(tx, userId, expiresAt);
    await tx.report.updateMany({ where: { reportedUserId: userId, status: "OPEN" }, data: { status: "ACTIONED" } });
    await logAdminAction(tx, { actorId: adminId, action: "user.suspend", targetType: "User", targetId: userId, reason: why });
  });
}

/** Lift a suspension. The retained document hashes are released too. */
export async function unsuspendUser(adminId: string, userId: string) {
  await assertAdmin(adminId);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } });
  if (!u?.suspendedAt) throw new ServiceError("INVALID", "This person is not suspended.");
  await prisma.$transaction(async (tx) => {
    const hashes = await ownHashes(tx, userId);
    if (hashes.length) await tx.blockedDocument.deleteMany({ where: { docNumberHash: { in: hashes } } });
    await tx.user.update({ where: { id: userId }, data: { suspendedAt: null, suspendedReason: null } });
    await logAdminAction(tx, { actorId: adminId, action: "user.unsuspend", targetType: "User", targetId: userId });
  });
}

/** Clear an automatic restriction (reports stay; dismiss unfounded ones first). */
export async function liftUserRestriction(adminId: string, userId: string) {
  await assertAdmin(adminId);
  await prisma.$transaction(async (tx) => {
    await liftRestriction(userId, tx);
    await logAdminAction(tx, { actorId: adminId, action: "user.lift_restriction", targetType: "User", targetId: userId });
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ownHashes(tx: Tx, userId: string): Promise<string[]> {
  const rows = await tx.idVerification.findMany({ where: { userId, docNumberHash: { not: null } }, select: { docNumberHash: true } });
  return [...new Set(rows.map((r) => r.docNumberHash!))];
}

/** Remember the document hashes of this person (used on suspension, and again on account deletion). */
export async function retainDocumentHashes(tx: Tx, userId: string, expiresAt: Date) {
  const rows = await tx.idVerification.findMany({
    where: { userId, docNumberHash: { not: null } },
    select: { docNumberHash: true, countryCode: true },
  });
  const seen = new Set<string>();
  const data = rows.flatMap((r) => (seen.has(r.docNumberHash!) ? [] : (seen.add(r.docNumberHash!), [{ docNumberHash: r.docNumberHash!, countryCode: r.countryCode, expiresAt }])));
  if (data.length) await tx.blockedDocument.createMany({ data, skipDuplicates: true });
}

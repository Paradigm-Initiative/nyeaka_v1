import { prisma } from "@/neon-db";
import { Prisma } from "@/generated/prisma/client";
import { reportSchema, type ReportInput } from "@/validations/safety-validation";
import { ServiceError } from "./errors";
import { cancelActiveMatchesBetween } from "./matches";
import { limitBlocks, limitReports } from "./rate-limit";
import { notifyAdmin, sendSafely } from "./notify";
import { reportEmail, restrictedUserEmail, restrictionAdminEmail } from "./email-templates";
import { reasonLabel } from "./report-options";

/** Different people who must report someone before they are restricted. */
export const REPORT_THRESHOLD = 3;
/** Different people who must block someone before they are restricted. */
export const BLOCK_THRESHOLD = 5;

// ---- who has dealt with whom -------------------------------------------------

/** True if the two people have (or had) a match, which means a chat between them. */
export async function sharesMatch(a: string, b: string): Promise<boolean> {
  const m = await prisma.match.findFirst({
    where: { OR: [{ donorId: a, requesterId: b }, { donorId: b, requesterId: a }] },
    select: { id: true },
  });
  return m !== null;
}

/** True if either person has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const n = await prisma.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return n > 0;
}

// ---- restriction ---------------------------------------------------------------

export const RESTRICTED_MESSAGE =
  "Your account is restricted while we review reports about it, so you can't post or send offers right now.";

export async function assertNotRestricted(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { restrictedAt: true } });
  if (u?.restrictedAt) throw new ServiceError("FORBIDDEN", RESTRICTED_MESSAGE);
}

/**
 * Restrict the user if enough different people have reported or blocked them.
 * Reports that an admin dismissed don't count. Returns the reason if this call
 * is the one that restricted them, otherwise null. Emails go out afterwards and
 * never fail the caller.
 */
export async function evaluateRestriction(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, name: true, restrictedAt: true },
  });
  if (!user || user.restrictedAt) return null;

  const [reporters, blockers] = await Promise.all([
    prisma.report.findMany({
      where: { reportedUserId: userId, status: { not: "DISMISSED" } },
      distinct: ["reporterId"],
      select: { reporterId: true },
    }),
    // One block per pair (unique), so this counts different blockers.
    prisma.block.count({ where: { blockedId: userId } }),
  ]);

  const reason =
    reporters.length >= REPORT_THRESHOLD
      ? `${reporters.length} reports from different people`
      : blockers >= BLOCK_THRESHOLD
        ? `${blockers} blocks from different people`
        : null;
  if (!reason) return null;

  // Conditional, so two simultaneous triggers restrict (and email) once.
  const { count } = await prisma.user.updateMany({
    where: { id: userId, restrictedAt: null },
    data: { restrictedAt: new Date(), restrictedReason: reason },
  });
  if (count === 0) return null;

  await Promise.all([
    notifyAdmin(restrictionAdminEmail({ user: { id: user.id, name: user.name, email: user.email }, reason }), "restriction"),
    sendSafely(user.email, restrictedUserEmail(user.firstName, process.env.ADMIN_EMAIL), "restriction notice"),
  ]);
  return reason;
}

/** Admin action: clear a restriction. Reports stay; dismiss them first if they were unfounded. */
export async function liftRestriction(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { restrictedAt: null, restrictedReason: null } });
}

// ---- block ---------------------------------------------------------------------

/**
 * Block someone you have been matched with. In one transaction this records the
 * block, declines pending offers between you, and cancels active matches (which
 * frees both posts). The other person is never told. Idempotent.
 */
export async function blockUser(blockerId: string, blockedId: string): Promise<{ created: boolean }> {
  if (blockerId === blockedId) throw new ServiceError("INVALID", "You can't block yourself.");
  if (!(await sharesMatch(blockerId, blockedId)))
    throw new ServiceError("FORBIDDEN", "You can only block someone you have been matched with.");

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });
  if (existing) return { created: false };

  await limitBlocks(blockerId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.block.create({ data: { blockerId, blockedId } });
      await tx.offer.updateMany({
        where: {
          status: "PENDING",
          OR: [
            { donorId: blockerId, request: { requesterId: blockedId } },
            { donorId: blockedId, request: { requesterId: blockerId } },
          ],
        },
        data: { status: "DECLINED" },
      });
      await cancelActiveMatchesBetween(tx, blockerId, blockedId);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false };
    throw e;
  }

  await evaluateRestriction(blockedId);
  return { created: true };
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
}

// ---- report --------------------------------------------------------------------

/**
 * Report someone you have been matched with, about themselves or one of their
 * posts. Reports are only possible where there is a chat between the two of you.
 * The admin is emailed, and the person is restricted once enough different
 * people have reported them.
 */
export async function reportUser(reporterId: string, input: ReportInput): Promise<{ id: string }> {
  const r = reportSchema.parse(input);

  let reportedUserId: string;
  let targetLabel: string;
  const target: Prisma.ReportUncheckedCreateInput = {
    reporterId,
    reportedUserId: "",
    targetType: r.targetType,
    reason: r.reason,
    details: r.details,
  };
  if (r.targetType === "USER") {
    reportedUserId = r.targetId;
    target.targetUserId = r.targetId;
    targetLabel = "the person";
  } else if (r.targetType === "LISTING") {
    const l = await prisma.listing.findUnique({ where: { id: r.targetId }, select: { donorId: true, title: true } });
    if (!l) throw new ServiceError("NOT_FOUND", "Listing not found");
    reportedUserId = l.donorId;
    target.targetListingId = r.targetId;
    targetLabel = `listing "${l.title}"`;
  } else {
    const q = await prisma.request.findUnique({ where: { id: r.targetId }, select: { requesterId: true, title: true } });
    if (!q) throw new ServiceError("NOT_FOUND", "Request not found");
    reportedUserId = q.requesterId;
    target.targetRequestId = r.targetId;
    targetLabel = `request "${q.title}"`;
  }
  target.reportedUserId = reportedUserId;

  if (reportedUserId === reporterId) throw new ServiceError("INVALID", "You can't report yourself.");
  if (!(await sharesMatch(reporterId, reportedUserId)))
    throw new ServiceError("FORBIDDEN", "You can only report someone you have been matched with.");

  const duplicate = await prisma.report.findFirst({
    where: { reporterId, reportedUserId, status: "OPEN" },
    select: { id: true },
  });
  const already = "You've already reported this person. We're reviewing it.";
  if (duplicate) throw new ServiceError("INVALID", already);

  await limitReports(reporterId);

  let report: { id: string };
  try {
    report = await prisma.report.create({ data: target, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ServiceError("INVALID", already);
    throw e;
  }

  // From here on the report is saved; nothing below may fail the caller.
  try {
    const [reporter, reported, reporters] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: reporterId }, select: { id: true, name: true, email: true } }),
      prisma.user.findUniqueOrThrow({ where: { id: reportedUserId }, select: { id: true, name: true, email: true } }),
      prisma.report.findMany({
        where: { reportedUserId, status: { not: "DISMISSED" } },
        distinct: ["reporterId"],
        select: { reporterId: true },
      }),
    ]);
    await notifyAdmin(
      reportEmail({
        reporter,
        reported,
        target: targetLabel,
        reason: reasonLabel(r.reason),
        details: r.details,
        openReports: reporters.length,
      }),
      "report",
    );
    await evaluateRestriction(reportedUserId);
  } catch (e) {
    console.error("report follow-up failed", e);
  }
  return report;
}

// ---- reading -------------------------------------------------------------------

export function getBlockedUsers(userId: string) {
  return prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: "desc" },
    select: { blockedId: true, createdAt: true, blocked: { select: { firstName: true } } },
  });
}

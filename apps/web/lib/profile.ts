import { prisma } from "@/neon-db";
import { getReputation } from "./queries";
import { hasDealings, isBlockedBetween } from "./safety";

export const PROFILE_COMMENTS = 20;

/**
 * What anyone may see about a person: first name and last initial, country, member
 * since, verified badge and how people rated them (score and comment). Never email,
 * phone or documents. Returns null (a 404) for people who are suspended, deleted,
 * restricted, or blocked either way with the viewer, so a profile never confirms any of that.
 */
export async function getPublicProfile(userId: string, viewerId?: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, firstName: true, lastName: true, countryCode: true, createdAt: true,
      idVerificationStatus: true, restrictedAt: true, suspendedAt: true, deletedAt: true,
    },
  });
  if (!u || u.deletedAt || u.suspendedAt) return null;
  const isSelf = viewerId === userId;
  if (!isSelf && (u.restrictedAt || (viewerId && (await isBlockedBetween(viewerId, userId))))) return null;

  const [reputation, ratings, dealings, blockedByMe] = await Promise.all([
    getReputation(userId),
    prisma.rating.findMany({
      where: { rateeId: userId, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: PROFILE_COMMENTS * 2, // some comments are blank after trimming
      select: { id: true, score: true, comment: true, createdAt: true, rater: { select: { firstName: true, deletedAt: true } } },
    }),
    viewerId && !isSelf ? hasDealings(viewerId, userId) : Promise.resolve(false),
    viewerId && !isSelf
      ? prisma.block.count({ where: { blockerId: viewerId, blockedId: userId } }).then((n) => n > 0)
      : Promise.resolve(false),
  ]);

  const comments = ratings
    .filter((r) => r.comment?.trim())
    .slice(0, PROFILE_COMMENTS)
    .map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment!.trim(),
      createdAt: r.createdAt,
      // Someone who deleted their account is no longer named.
      by: r.rater.deletedAt ? null : r.rater.firstName,
    }));

  return {
    id: u.id,
    displayName: `${u.firstName} ${u.lastName.trim()[0] ?? ""}`.trim() + (u.lastName.trim() ? "." : ""),
    firstName: u.firstName,
    countryCode: u.countryCode,
    memberSince: u.createdAt,
    verified: u.idVerificationStatus === "VERIFIED",
    isSelf,
    reputation,
    comments,
    canReport: dealings,
    blockedByMe,
  };
}

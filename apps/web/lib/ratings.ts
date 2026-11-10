import { prisma } from "@/neon-db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { ServiceError } from "./errors";
import { RATING_COMMENT_MAX, RATING_WINDOW_DAYS, ratingVerdict } from "./rating-rules";

export const rateSchema = z.object({
  score: z.number({ error: "Choose a star rating" }).int().min(1, "Choose a star rating").max(5),
  comment: z
    .string()
    .trim()
    .max(RATING_COMMENT_MAX, `Keep it under ${RATING_COMMENT_MAX} characters`)
    .optional()
    .transform((v) => v || undefined),
});
export type RateInput = z.input<typeof rateSchema>;

const endedAt = (m: { handedOverAt: Date | null; cancelledAt: Date | null; updatedAt: Date }) =>
  m.handedOverAt ?? m.cancelledAt ?? m.updatedAt;

/** Rate the other person in a match that has ended (see ratingVerdict for when that is). */
export async function rateMatch(userId: string, matchId: string, input: RateInput): Promise<{ id: string }> {
  const { score, comment } = rateSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      donorId: true,
      requesterId: true,
      handedOverAt: true,
      cancelledAt: true,
      updatedAt: true,
      conversation: { select: { id: true } },
      ratings: { where: { raterId: userId }, select: { id: true } },
    },
  });
  if (!match) throw new ServiceError("NOT_FOUND", "Match not found");
  const isDonor = match.donorId === userId;
  if (!isDonor && match.requesterId !== userId)
    throw new ServiceError("FORBIDDEN", "You are not part of this match");
  const rateeId = isDonor ? match.requesterId : match.donorId;

  const [senders, blocks] = await Promise.all([
    match.conversation
      ? prisma.message.groupBy({ by: ["senderId"], where: { conversationId: match.conversation.id } })
      : Promise.resolve([]),
    prisma.block.count({
      where: { OR: [{ blockerId: userId, blockedId: rateeId }, { blockerId: rateeId, blockedId: userId }] },
    }),
  ]);
  const sent = new Set(senders.map((s) => s.senderId));

  const verdict = ratingVerdict({
    status: match.status,
    endedAt: endedAt(match),
    bothMessaged: sent.has(match.donorId) && sent.has(match.requesterId),
    blocked: blocks > 0,
    alreadyRated: match.ratings.length > 0,
  });
  if (!verdict.ok) throw new ServiceError("INVALID", verdict.reason);

  try {
    return await prisma.rating.create({
      data: { matchId, raterId: userId, rateeId, score, comment },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ServiceError("INVALID", "You've already rated this match.");
    throw e;
  }
}

export interface RatingPrompt {
  matchId: string;
  conversationId: string | null;
  otherFirstName: string;
  listingTitle: string;
  status: "HANDED_OVER" | "CANCELLED";
  endedAt: Date;
}

/** Ended matches the user can still rate and hasn't. Powers the dashboard prompt. */
export async function getMatchesToRate(userId: string): Promise<RatingPrompt[]> {
  const since = new Date(Date.now() - (RATING_WINDOW_DAYS + 1) * 86_400_000);
  const rows = await prisma.match.findMany({
    where: {
      status: { in: ["HANDED_OVER", "CANCELLED"] },
      updatedAt: { gt: since },
      OR: [{ donorId: userId }, { requesterId: userId }],
      ratings: { none: { raterId: userId } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      donorId: true,
      requesterId: true,
      handedOverAt: true,
      cancelledAt: true,
      updatedAt: true,
      conversation: { select: { id: true } },
      listing: { select: { title: true } },
      donor: { select: { firstName: true } },
      requester: { select: { firstName: true } },
    },
  });
  if (rows.length === 0) return [];

  const otherOf = (m: (typeof rows)[number]) => (m.donorId === userId ? m.requesterId : m.donorId);
  const convIds = rows.flatMap((m) => (m.status === "CANCELLED" && m.conversation ? [m.conversation.id] : []));
  const [senders, blocks] = await Promise.all([
    convIds.length
      ? prisma.message.groupBy({ by: ["conversationId", "senderId"], where: { conversationId: { in: convIds } } })
      : Promise.resolve([]),
    prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: rows.map(otherOf) } },
          { blockedId: userId, blockerId: { in: rows.map(otherOf) } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  return rows.flatMap((m): RatingPrompt[] => {
    const other = otherOf(m);
    const talked = new Set(senders.filter((s) => s.conversationId === m.conversation?.id).map((s) => s.senderId));
    const verdict = ratingVerdict({
      status: m.status,
      endedAt: endedAt(m),
      bothMessaged: talked.has(m.donorId) && talked.has(m.requesterId),
      blocked: blocks.some((b) => b.blockerId === other || b.blockedId === other),
      alreadyRated: false,
    });
    if (!verdict.ok || m.status === "ACTIVE") return [];
    return [
      {
        matchId: m.id,
        conversationId: m.conversation?.id ?? null,
        otherFirstName: m.donorId === userId ? m.requester.firstName : m.donor.firstName,
        listingTitle: m.listing.title,
        status: m.status,
        endedAt: endedAt(m),
      },
    ];
  });
}

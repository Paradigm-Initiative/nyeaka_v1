import { prisma } from "@/neon-db";
import {
  sendMessageSchema,
  type SendMessageInput,
} from "@/validations/message-validation";
import { ServiceError } from "./errors";
import { placeLabel } from "./format";
import { limitMessages } from "./rate-limit";
import { isBlockedBetween } from "./safety";
import { ratingVerdict } from "./rating-rules";

/** The thread view loads this many of the most recent messages. */
export const THREAD_PAGE_SIZE = 200;

export interface ThreadMessage {
  id: string;
  mine: boolean;
  body: string;
  createdAt: Date;
}

export interface Thread {
  id: string;
  matchId: string;
  matchStatus: "ACTIVE" | "HANDED_OVER" | "CANCELLED";
  role: "donor" | "requester";
  other: { id: string; firstName: string; idVerified: boolean };
  /** You blocked them. They are never told they were blocked, so there is no "they blocked you". */
  blockedByMe: boolean;
  /** False when the match is cancelled or either of you has blocked the other. */
  canSend: boolean;
  /** Numbers are shown only when BOTH people have opted in. */
  phone: {
    /** False when the match is cancelled or blocked: sharing is switched off. */
    available: boolean;
    hasMine: boolean;
    iShared: boolean;
    theyShared: boolean;
    theirNumber: string | null;
  };
  handoff: { iConfirmed: boolean; theyConfirmed: boolean };
  rating: {
    canRate: boolean;
    /** Why not, when it is not open yet (or any more). */
    reason: string | null;
    mine: { score: number; comment: string | null } | null;
  };
  listingTitle: string;
  requestTitle: string;
  place: string;
  messages: ThreadMessage[];
}

/**
 * Load a conversation for one of its two participants.
 * NOT_FOUND if it doesn't exist, FORBIDDEN if the user isn't in the match.
 * Callers that render pages should treat both as "not found" so thread ids
 * don't reveal that a conversation exists.
 */
export async function getThread(userId: string, conversationId: string): Promise<Thread> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      match: {
        select: {
          id: true,
          status: true,
          donorId: true,
          requesterId: true,
          donorSharedPhone: true,
          requesterSharedPhone: true,
          donorConfirmedAt: true,
          requesterConfirmedAt: true,
          handedOverAt: true,
          cancelledAt: true,
          updatedAt: true,
          ratings: { where: { raterId: userId }, select: { score: true, comment: true } },
          donor: { select: { id: true, firstName: true, idVerified: true, phone: true } },
          requester: { select: { id: true, firstName: true, idVerified: true, phone: true } },
          listing: { select: { title: true, city: true, area: true } },
          request: { select: { title: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: THREAD_PAGE_SIZE,
        select: { id: true, senderId: true, body: true, createdAt: true },
      },
    },
  });
  if (!conv) throw new ServiceError("NOT_FOUND", "Conversation not found");

  const m = conv.match;
  const isDonor = m.donorId === userId;
  if (!isDonor && m.requesterId !== userId)
    throw new ServiceError("FORBIDDEN", "You are not part of this conversation");

  const other = isDonor ? m.requester : m.donor;
  const me = isDonor ? m.donor : m.requester;
  const [blocks, senders] = await Promise.all([
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId, blockedId: other.id }, { blockerId: other.id, blockedId: userId }] },
      select: { blockerId: true },
    }),
    // Only a cancelled match needs this: ratings there require that both people spoke.
    m.status === "CANCELLED"
      ? prisma.message.groupBy({ by: ["senderId"], where: { conversationId } })
      : Promise.resolve([]),
  ]);
  const iShared = isDonor ? m.donorSharedPhone : m.requesterSharedPhone;
  const theyShared = isDonor ? m.requesterSharedPhone : m.donorSharedPhone;
  const phoneOpen = m.status !== "CANCELLED" && blocks.length === 0;
  const talked = new Set(senders.map((s) => s.senderId));
  const mine = m.ratings[0] ?? null;
  const verdict = ratingVerdict({
    status: m.status,
    endedAt: m.handedOverAt ?? m.cancelledAt ?? m.updatedAt,
    bothMessaged: talked.has(m.donorId) && talked.has(m.requesterId),
    blocked: blocks.length > 0,
    alreadyRated: mine !== null,
  });

  return {
    id: conv.id,
    matchId: m.id,
    matchStatus: m.status,
    role: isDonor ? "donor" : "requester",
    other: { id: other.id, firstName: other.firstName, idVerified: other.idVerified },
    blockedByMe: blocks.some((b) => b.blockerId === userId),
    canSend: m.status !== "CANCELLED" && blocks.length === 0,
    phone: {
      available: phoneOpen,
      hasMine: !!me.phone,
      iShared,
      theyShared,
      // Never leaves the server unless both opted in and sharing is still open.
      theirNumber: phoneOpen && iShared && theyShared ? other.phone : null,
    },
    handoff: {
      iConfirmed: !!(isDonor ? m.donorConfirmedAt : m.requesterConfirmedAt),
      theyConfirmed: !!(isDonor ? m.requesterConfirmedAt : m.donorConfirmedAt),
    },
    rating: {
      canRate: verdict.ok,
      reason: verdict.ok || mine ? null : verdict.reason,
      mine,
    },
    listingTitle: m.listing.title,
    requestTitle: m.request.title,
    place: placeLabel(m.listing.city, m.listing.area),
    // Fetched newest-first so the cap keeps the latest; shown oldest-first.
    messages: conv.messages
      .reverse()
      .map((x) => ({ id: x.id, mine: x.senderId === userId, body: x.body, createdAt: x.createdAt })),
  };
}

/** Mark everything the other person sent as read. Own messages are never touched. */
export async function markThreadRead(userId: string, conversationId: string) {
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Add a message. Only the two participants can write, and not once the match is cancelled. */
export async function sendMessage(userId: string, conversationId: string, input: SendMessageInput) {
  const { body } = sendMessageSchema.parse(input);

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { match: { select: { status: true, donorId: true, requesterId: true } } },
  });
  if (!conv) throw new ServiceError("NOT_FOUND", "Conversation not found");
  const { status, donorId, requesterId } = conv.match;
  if (userId !== donorId && userId !== requesterId)
    throw new ServiceError("FORBIDDEN", "You are not part of this conversation");
  if (status === "CANCELLED")
    throw new ServiceError("INVALID", "This match was cancelled, so the chat is closed.");

  if (await isBlockedBetween(donorId, requesterId))
    throw new ServiceError("INVALID", "You can't send messages in this conversation.");

  await limitMessages(userId);

  return prisma.message.create({
    data: { conversationId, senderId: userId, body },
    select: { id: true, createdAt: true },
  });
}

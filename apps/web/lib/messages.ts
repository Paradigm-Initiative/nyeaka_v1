import { prisma } from "@/neon-db";
import {
  sendMessageSchema,
  type SendMessageInput,
} from "@/validations/message-validation";
import { ServiceError } from "./errors";
import { placeLabel } from "./format";
import { limitMessages } from "./rate-limit";

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
  other: { firstName: string; idVerified: boolean };
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
          donor: { select: { firstName: true, idVerified: true } },
          requester: { select: { firstName: true, idVerified: true } },
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

  return {
    id: conv.id,
    matchId: m.id,
    matchStatus: m.status,
    role: isDonor ? "donor" : "requester",
    other: isDonor ? m.requester : m.donor,
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

  await limitMessages(userId);

  return prisma.message.create({
    data: { conversationId, senderId: userId, body },
    select: { id: true, createdAt: true },
  });
}

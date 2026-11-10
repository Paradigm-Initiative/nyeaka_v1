import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertState, postState } from "./lifecycle";

/** Someone to tell (after the transaction commits) that their offer was not chosen. */
export interface NotSelectedNotice {
  offerId: string;
  recipientId: string;
  /** donor: their offer lost out on a request. requester: the device they asked for went elsewhere. */
  recipientRole: "donor" | "requester";
  listingTitle: string;
  requestTitle: string;
}

export interface AcceptResult {
  matchId: string;
  conversationId: string;
  /** Sender of the accepted offer, who should be told it was accepted. */
  offerSenderId: string;
  notSelected: NotSelectedNotice[];
}

/** The side that did not send the offer is the side that decides. */
function receiverId(o: { initiatedById: string; donorId: string; requesterId: string }) {
  return o.initiatedById === o.donorId ? o.requesterId : o.donorId;
}

/**
 * Accept an offer. In one transaction: mark the offer ACCEPTED, create the match
 * and its conversation, mark both posts MATCHED, and decline every other PENDING
 * offer that used the same listing or the same request.
 *
 * Each state change is a conditional update (`where status = ...`), so if two
 * accepts race, the loser matches zero rows, throws, and rolls back.
 *
 * Emails are the caller's job and must be sent after this returns, never inside it.
 */
export async function acceptOffer(userId: string, offerId: string): Promise<AcceptResult> {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        status: true,
        donorId: true,
        initiatedById: true,
        listingId: true,
        requestId: true,
        listing: { select: { status: true, expiresAt: true } },
        request: { select: { requesterId: true, status: true, expiresAt: true } },
      },
    });
    if (!offer) throw new ServiceError("NOT_FOUND", "Offer not found");

    const requesterId = offer.request.requesterId;
    if (receiverId({ ...offer, requesterId }) !== userId)
      throw new ServiceError("FORBIDDEN", "Only the person who received this offer can answer it.");
    if (offer.status !== "PENDING")
      throw new ServiceError("INVALID", "This offer has already been answered.");

    assertState(postState(offer.listing.status, offer.listing.expiresAt), ["ACTIVE"], "This device is no longer available.");
    assertState(postState(offer.request.status, offer.request.expiresAt), ["ACTIVE"], "This request is no longer open.");

    const claimed = async (p: Promise<{ count: number }>) => {
      if ((await p).count === 0)
        throw new ServiceError("INVALID", "This offer is no longer available.");
    };
    await claimed(tx.offer.updateMany({ where: { id: offerId, status: "PENDING" }, data: { status: "ACCEPTED" } }));
    await claimed(tx.listing.updateMany({ where: { id: offer.listingId, status: "ACTIVE" }, data: { status: "MATCHED" } }));
    await claimed(tx.request.updateMany({ where: { id: offer.requestId, status: "ACTIVE" }, data: { status: "MATCHED" } }));

    const match = await tx.match.create({
      data: {
        offerId,
        donorId: offer.donorId,
        requesterId,
        listingId: offer.listingId,
        requestId: offer.requestId,
        conversation: { create: {} },
      },
      select: { id: true, conversation: { select: { id: true } } },
    });

    // Everything else waiting on this device or this request is now moot.
    const others = await tx.offer.findMany({
      where: {
        status: "PENDING",
        id: { not: offerId },
        OR: [{ requestId: offer.requestId }, { listingId: offer.listingId }],
      },
      select: {
        id: true,
        donorId: true,
        listing: { select: { title: true } },
        request: { select: { title: true, requesterId: true } },
      },
    });
    if (others.length)
      await tx.offer.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "DECLINED" },
      });

    // Tell whoever on each declined offer is not part of the new match.
    const notSelected: NotSelectedNotice[] = others.map((o) => {
      const donorIsOutsider = o.donorId !== offer.donorId;
      return {
        offerId: o.id,
        recipientId: donorIsOutsider ? o.donorId : o.request.requesterId,
        recipientRole: donorIsOutsider ? "donor" : "requester",
        listingTitle: o.listing.title,
        requestTitle: o.request.title,
      };
    });

    return {
      matchId: match.id,
      conversationId: match.conversation!.id,
      offerSenderId: offer.initiatedById,
      notSelected,
    };
  });
}

/** The receiving side turns an offer down. Nothing else changes. */
export async function declineOffer(userId: string, offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      donorId: true,
      initiatedById: true,
      request: { select: { requesterId: true } },
    },
  });
  if (!offer) throw new ServiceError("NOT_FOUND", "Offer not found");
  if (receiverId({ ...offer, requesterId: offer.request.requesterId }) !== userId)
    throw new ServiceError("FORBIDDEN", "Only the person who received this offer can answer it.");

  const { count } = await prisma.offer.updateMany({
    where: { id: offerId, status: "PENDING" },
    data: { status: "DECLINED" },
  });
  if (count === 0) throw new ServiceError("INVALID", "This offer has already been answered.");
  return { offerSenderId: offer.initiatedById };
}

/**
 * Either participant can call off an ACTIVE match (not one already handed over).
 * The device and the request go back to ACTIVE so each can be matched again.
 * The accepted offer stays ACCEPTED as history, and offers declined when the
 * match was made stay declined.
 */
export async function cancelMatch(userId: string, matchId: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: { donorId: true, requesterId: true, listingId: true, requestId: true },
    });
    if (!match) throw new ServiceError("NOT_FOUND", "Match not found");
    if (userId !== match.donorId && userId !== match.requesterId)
      throw new ServiceError("FORBIDDEN", "Only the two people in this match can cancel it.");

    const { count } = await tx.match.updateMany({
      where: { id: matchId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    if (count === 0)
      throw new ServiceError("INVALID", "Only an active match can be cancelled.");

    await tx.listing.updateMany({ where: { id: match.listingId, status: "MATCHED" }, data: { status: "ACTIVE" } });
    await tx.request.updateMany({ where: { id: match.requestId, status: "MATCHED" }, data: { status: "ACTIVE" } });

    // The other person is the one to tell.
    return { otherPartyId: userId === match.donorId ? match.requesterId : match.donorId };
  });
}

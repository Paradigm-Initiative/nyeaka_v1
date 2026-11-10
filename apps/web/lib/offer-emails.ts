import { prisma } from "@/neon-db";
import type { AcceptResult } from "./matches";
import { appUrl } from "./app-url";
import { sendSafely } from "./notify";
import {
  matchCancelledEmail,
  offerAcceptedEmail,
  offerNotSelectedEmail,
  offerReceivedEmail,
} from "./email-templates";

/**
 * Emails for the offer and match lifecycle. Call these AFTER the database change
 * has committed (from `after()` in the action). Each one swallows its own
 * failures: a mail problem must never undo or fail what the user just did.
 */

type Who = { id: string; email: string; firstName: string };

async function usersById(ids: string[]): Promise<Map<string, Who>> {
  const rows = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, email: true, firstName: true },
  });
  return new Map(rows.map((u) => [u.id, u]));
}

async function guarded(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (e) {
    console.error(`${label}: could not prepare email`, e);
  }
}

/** A new offer: tell the person who has to answer it. */
export function emailOfferReceived(offerId: string) {
  return guarded("offer received", async () => {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: {
        initiatedById: true,
        donorId: true,
        listing: { select: { title: true } },
        request: { select: { title: true, requesterId: true } },
      },
    });
    if (!offer) return;
    const receiverId = offer.initiatedById === offer.donorId ? offer.request.requesterId : offer.donorId;
    const users = await usersById([offer.initiatedById, receiverId]);
    const [from, to] = [users.get(offer.initiatedById), users.get(receiverId)];
    if (!from || !to) return;

    await sendSafely(
      to.email,
      offerReceivedEmail({
        firstName: to.firstName,
        from: from.firstName,
        kind: offer.initiatedById === offer.donorId ? "donor-offer" : "requester-ask",
        listingTitle: offer.listing.title,
        requestTitle: offer.request.title,
        url: appUrl("/dashboard"),
      }),
      "offer received",
    );
  });
}

/**
 * An accepted offer: tell the sender it was accepted, and tell everyone whose
 * offer was closed as a result so they are not left waiting.
 */
export function emailOfferAccepted(accepterId: string, result: AcceptResult) {
  return guarded("offer accepted", async () => {
    const match = await prisma.match.findUnique({
      where: { id: result.matchId },
      select: { listing: { select: { title: true } } },
    });
    const users = await usersById([accepterId, result.offerSenderId, ...result.notSelected.map((n) => n.recipientId)]);

    const sender = users.get(result.offerSenderId);
    const accepter = users.get(accepterId);
    if (sender && accepter && match)
      await sendSafely(
        sender.email,
        offerAcceptedEmail({
          firstName: sender.firstName,
          accepter: accepter.firstName,
          listingTitle: match.listing.title,
          url: appUrl(`/messages/${result.conversationId}`),
        }),
        "offer accepted",
      );

    for (const n of result.notSelected) {
      const to = users.get(n.recipientId);
      if (!to) continue;
      await sendSafely(
        to.email,
        offerNotSelectedEmail({
          firstName: to.firstName,
          role: n.recipientRole,
          listingTitle: n.listingTitle,
          requestTitle: n.requestTitle,
          url: appUrl(n.recipientRole === "donor" ? "/requests" : "/listings"),
        }),
        "offer not selected",
      );
    }
  });
}

/** A cancelled match: tell the other person. Not used when a block cancels it. */
export function emailMatchCancelled(cancellerId: string, matchId: string) {
  return guarded("match cancelled", async () => {
    const m = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        donorId: true,
        requesterId: true,
        listing: { select: { title: true } },
        request: { select: { title: true } },
      },
    });
    if (!m) return;
    const otherId = cancellerId === m.donorId ? m.requesterId : m.donorId;
    const users = await usersById([cancellerId, otherId]);
    const [canceller, other] = [users.get(cancellerId), users.get(otherId)];
    if (!canceller || !other) return;

    await sendSafely(
      other.email,
      matchCancelledEmail({
        firstName: other.firstName,
        canceller: canceller.firstName,
        role: otherId === m.donorId ? "donor" : "requester",
        listingTitle: m.listing.title,
        requestTitle: m.request.title,
        url: appUrl("/dashboard"),
      }),
      "match cancelled",
    );
  });
}

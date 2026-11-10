import { prisma } from "@/neon-db";
import { placeLabel } from "./format";

export interface OfferOption {
  id: string;
  title: string;
  place: string;
  /** Why this one can't be used right now, or null if it can. */
  blocked: string | null;
}

export interface PendingOffer {
  id: string;
  initiatedByMe: boolean;
  /** Title of the viewer's own post that the offer involves. */
  yourPost: string;
}

export interface OfferContext {
  options: OfferOption[];
  pending: PendingOffer | null;
  /** The viewer cannot send another offer at all (donor with a PENDING offer on this request). */
  locked: boolean;
}

const liveNow = () => ({ status: "ACTIVE" as const, expiresAt: { gt: new Date() } });

const SENT: Record<string, string> = {
  PENDING: "Offer already sent",
  ACCEPTED: "Already matched",
  DECLINED: "Already offered and declined",
  WITHDRAWN: "Already offered and withdrawn",
};

/**
 * Listing page, viewer is a prospective requester: which of THEIR live requests
 * could they ask this device for?
 */
export async function getListingOfferContext(
  viewerId: string,
  listingId: string,
  donorId: string,
): Promise<OfferContext> {
  const requests = await prisma.request.findMany({
    where: { requesterId: viewerId, ...liveNow() },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      city: true,
      area: true,
      // This device on this request (any state), or this donor's PENDING offer on it.
      offers: {
        where: { OR: [{ listingId }, { donorId, status: "PENDING" }] },
        select: { id: true, listingId: true, status: true, initiatedById: true },
      },
    },
  });

  let pending: PendingOffer | null = null;
  const options = requests.map((r): OfferOption => {
    const same = r.offers.find((o) => o.listingId === listingId);
    const donorBusy = r.offers.some((o) => o.listingId !== listingId);
    if (same?.status === "PENDING" && !pending)
      pending = { id: same.id, initiatedByMe: same.initiatedById === viewerId, yourPost: r.title };
    return {
      id: r.id,
      title: r.title,
      place: placeLabel(r.city, r.area),
      blocked: same ? SENT[same.status] : donorBusy ? "This donor already has an offer on it" : null,
    };
  });
  return { options, pending, locked: false };
}

/**
 * Request page, viewer is a prospective donor: which of THEIR live listings can
 * they offer? A donor may only have one PENDING offer per request.
 */
export async function getRequestOfferContext(
  viewerId: string,
  requestId: string,
): Promise<OfferContext> {
  const [listings, pendingRow] = await Promise.all([
    prisma.listing.findMany({
      where: { donorId: viewerId, ...liveNow() },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        city: true,
        area: true,
        offers: { where: { requestId }, select: { status: true } },
      },
    }),
    prisma.offer.findFirst({
      where: { requestId, donorId: viewerId, status: "PENDING" },
      select: { id: true, initiatedById: true, listing: { select: { title: true } } },
    }),
  ]);

  const pending: PendingOffer | null = pendingRow && {
    id: pendingRow.id,
    initiatedByMe: pendingRow.initiatedById === viewerId,
    yourPost: pendingRow.listing.title,
  };
  const options = listings.map((l): OfferOption => {
    const same = l.offers[0];
    return {
      id: l.id,
      title: l.title,
      place: placeLabel(l.city, l.area),
      blocked: same ? SENT[same.status] : null,
    };
  });
  return { options, pending, locked: pending !== null };
}

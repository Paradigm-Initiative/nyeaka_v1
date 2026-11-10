import { prisma } from "@/neon-db";
import { Prisma } from "@/generated/prisma/client";
import {
  createOfferSchema,
  type CreateOfferInput,
} from "@/validations/offer-validation";
import { ServiceError } from "./errors";
import { assertState, postState } from "./lifecycle";
import { limitOffers } from "./rate-limit";

const ALREADY_OFFERED = "You already have an active offer on this request.";

/**
 * Send an offer linking one listing to one request.
 *
 * `userId` must be the listing's donor (offering a device) or the request's
 * requester (asking for a device). Either way the same Offer row is created;
 * `initiatedById` records who sent it so the other side is the one who decides.
 */
export async function createOffer(userId: string, input: CreateOfferInput) {
  const { listingId, requestId, message } = createOfferSchema.parse(input);

  const [listing, request] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: listingId },
      select: { donorId: true, status: true, expiresAt: true },
    }),
    prisma.request.findUnique({
      where: { id: requestId },
      select: { requesterId: true, status: true, expiresAt: true },
    }),
  ]);
  if (!listing) throw new ServiceError("NOT_FOUND", "Listing not found");
  if (!request) throw new ServiceError("NOT_FOUND", "Request not found");

  if (listing.donorId === request.requesterId)
    throw new ServiceError("INVALID", "You can't offer on your own post.");
  if (userId !== listing.donorId && userId !== request.requesterId)
    throw new ServiceError("FORBIDDEN", "You can only offer with your own listing or request.");

  assertState(
    postState(request.status, request.expiresAt),
    ["ACTIVE"],
    "This request is no longer open.",
  );
  assertState(
    postState(listing.status, listing.expiresAt),
    ["ACTIVE"],
    "This device is no longer available.",
  );

  const existing = await prisma.offer.findMany({
    where: {
      requestId,
      OR: [{ donorId: listing.donorId, status: "PENDING" }, { listingId }],
    },
    select: { listingId: true, donorId: true, status: true },
  });
  if (existing.some((o) => o.donorId === listing.donorId && o.status === "PENDING"))
    throw new ServiceError("INVALID", ALREADY_OFFERED);
  if (existing.some((o) => o.listingId === listingId))
    throw new ServiceError("INVALID", "This device was already offered on this request.");

  await limitOffers(userId);

  try {
    return await prisma.offer.create({
      data: {
        listingId,
        requestId,
        donorId: listing.donorId,
        initiatedById: userId,
        message,
      },
      select: { id: true },
    });
  } catch (e) {
    // Two clicks at once can both pass the checks above; the database is the final guard.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ServiceError("INVALID", ALREADY_OFFERED);
    throw e;
  }
}

/** The person who sent a PENDING offer can take it back. */
export async function withdrawOffer(userId: string, offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { initiatedById: true, status: true },
  });
  if (!offer) throw new ServiceError("NOT_FOUND", "Offer not found");
  if (offer.initiatedById !== userId)
    throw new ServiceError("FORBIDDEN", "You can only withdraw offers you sent.");

  // Conditional update: a concurrent accept/decline wins and we report it.
  const { count } = await prisma.offer.updateMany({
    where: { id: offerId, status: "PENDING" },
    data: { status: "WITHDRAWN" },
  });
  if (count === 0)
    throw new ServiceError("INVALID", "This offer has already been answered.");
}

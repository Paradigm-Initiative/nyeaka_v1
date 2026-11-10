import { prisma } from "@/neon-db";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type BrowseFilters } from "./browse-params";
import { postState } from "./lifecycle";
import { placeLabel } from "./format";
import { isBlockedBetween } from "./safety";

// Only live posts are public: ACTIVE and not past expiresAt.
const live = () => ({ status: "ACTIVE" as const, expiresAt: { gt: new Date() } });

/**
 * Whose posts a viewer may see: nobody who is restricted, and nobody they have
 * blocked or who has blocked them. Applied to browse lists and detail pages.
 * Owners still see their own posts through the dashboard and detail pages.
 */
const visibleOwner = (viewerId?: string): Prisma.UserWhereInput => ({
  restrictedAt: null,
  ...(viewerId && {
    NOT: {
      OR: [
        { blocksReceived: { some: { blockerId: viewerId } } },
        { blocksMade: { some: { blockedId: viewerId } } },
      ],
    },
  }),
});

const listingCardSelect = {
  id: true,
  deviceType: true,
  title: true,
  condition: true,
  city: true,
  area: true,
  photos: true,
  createdAt: true,
  donor: { select: { idVerified: true } },
} satisfies Prisma.ListingSelect;

const requestCardSelect = {
  id: true,
  deviceType: true,
  title: true,
  minCondition: true,
  city: true,
  area: true,
  createdAt: true,
  requester: { select: { idVerified: true } },
} satisfies Prisma.RequestSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;
export type RequestCardData = Prisma.RequestGetPayload<{ select: typeof requestCardSelect }>;

export function getRecentListings(take = 3, viewerId?: string): Promise<ListingCardData[]> {
  return prisma.listing.findMany({
    where: { ...live(), donor: visibleOwner(viewerId) },
    orderBy: { createdAt: "desc" },
    take,
    select: listingCardSelect,
  });
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

function paged<T>(items: T[], total: number, page: number): Paged<T> {
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getLiveListings(f: BrowseFilters, viewerId?: string): Promise<Paged<ListingCardData>> {
  const where: Prisma.ListingWhereInput = {
    ...live(),
    donor: visibleOwner(viewerId),
    ...(f.type && { deviceType: f.type }),
    ...(f.city && { city: { equals: f.city, mode: "insensitive" } }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { brand: { contains: f.q, mode: "insensitive" } },
        { model: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: listingCardSelect,
    }),
    prisma.listing.count({ where }),
  ]);
  return paged(items, total, f.page);
}

export async function getLiveRequests(f: BrowseFilters, viewerId?: string): Promise<Paged<RequestCardData>> {
  const where: Prisma.RequestWhereInput = {
    ...live(),
    requester: visibleOwner(viewerId),
    ...(f.type && { deviceType: f.type }),
    ...(f.city && { city: { equals: f.city, mode: "insensitive" } }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { preferredBrand: { contains: f.q, mode: "insensitive" } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: requestCardSelect,
    }),
    prisma.request.count({ where }),
  ]);
  return paged(items, total, f.page);
}

/** Distinct cities that currently have live posts of the given kind. */
export async function getCities(kind: "listing" | "request"): Promise<string[]> {
  const rows =
    kind === "listing"
      ? await prisma.listing.findMany({ where: live(), distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } })
      : await prisma.request.findMany({ where: live(), distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } });
  return rows.map((r) => r.city);
}

export async function getReputation(userId: string) {
  const [ratings, handoffs] = await Promise.all([
    prisma.rating.aggregate({ where: { rateeId: userId }, _avg: { score: true }, _count: true }),
    prisma.match.count({
      where: { status: "HANDED_OVER", OR: [{ donorId: userId }, { requesterId: userId }] },
    }),
  ]);
  return { rating: ratings._avg.score, ratingCount: ratings._count, handoffs };
}

/** Public can see live (or matched) posts; the owner can always see their own, in any state. */
export async function getListingDetail(id: string, viewerId?: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { spec: true, donor: { select: { id: true, firstName: true, restrictedAt: true } } },
  });
  if (!listing) return null;
  const isOwner = viewerId === listing.donorId;
  const state = postState(listing.status, listing.expiresAt);
  if (!isOwner && state !== "ACTIVE" && state !== "MATCHED") return null;
  if (!isOwner && (listing.donor.restrictedAt || (viewerId && (await isBlockedBetween(viewerId, listing.donorId)))))
    return null;
  return { listing, isOwner, state, reputation: await getReputation(listing.donorId) };
}

export async function getRequestDetail(id: string, viewerId?: string) {
  const request = await prisma.request.findUnique({
    where: { id },
    include: { requester: { select: { id: true, firstName: true, restrictedAt: true } } },
  });
  if (!request) return null;
  const isOwner = viewerId === request.requesterId;
  const state = postState(request.status, request.expiresAt);
  if (!isOwner && state !== "ACTIVE" && state !== "MATCHED") return null;
  if (!isOwner && (request.requester.restrictedAt || (viewerId && (await isBlockedBetween(viewerId, request.requesterId)))))
    return null;
  return { request, isOwner, state, reputation: await getReputation(request.requesterId) };
}

// Counts only offers still waiting for an answer, so "3 offers" means 3 to deal with.
const pendingOffers = { select: { offers: { where: { status: "PENDING" as const } } } };

export function getMyListings(userId: string) {
  return prisma.listing.findMany({
    where: { donorId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, city: true, area: true, condition: true, status: true, expiresAt: true, createdAt: true, _count: pendingOffers },
  });
}

export function getMyRequests(userId: string) {
  return prisma.request.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, city: true, area: true, minCondition: true, status: true, expiresAt: true, createdAt: true, _count: pendingOffers },
  });
}

export interface DashboardOffer {
  id: string;
  /** Which hat the viewer wears on this offer. */
  role: "donor" | "requester";
  /** received: the viewer must answer it. sent: the viewer made it. */
  direction: "received" | "sent";
  status: "PENDING" | "DECLINED";
  message: string | null;
  createdAt: Date;
  listingTitle: string;
  requestTitle: string;
  requestDescription: string;
  place: string;
  other: { firstName: string; idVerified: boolean };
}

/**
 * Every offer the user needs to answer or is waiting on, plus their own offers
 * that were not chosen. Accepted and withdrawn offers are history, not tasks.
 */
export async function getDashboardOffers(userId: string): Promise<DashboardOffer[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: { in: ["PENDING", "DECLINED"] },
      OR: [{ donorId: userId }, { request: { requesterId: userId } }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      donorId: true,
      initiatedById: true,
      donor: { select: { firstName: true, idVerified: true } },
      listing: { select: { title: true } },
      request: {
        select: {
          title: true,
          description: true,
          city: true,
          area: true,
          requester: { select: { firstName: true, idVerified: true } },
        },
      },
    },
  });

  return rows.flatMap((o): DashboardOffer[] => {
    const role = o.donorId === userId ? "donor" : "requester";
    const direction = o.initiatedById === userId ? "sent" : "received";
    // A declined offer only matters to the person who made it ("not selected").
    if (o.status === "DECLINED" && direction !== "sent") return [];
    return [
      {
        id: o.id,
        role,
        direction,
        status: o.status as "PENDING" | "DECLINED",
        message: o.message,
        createdAt: o.createdAt,
        listingTitle: o.listing.title,
        requestTitle: o.request.title,
        requestDescription: o.request.description,
        place: placeLabel(o.request.city, o.request.area),
        other: role === "donor" ? o.request.requester : o.donor,
      },
    ];
  });
}

export interface DashboardMatch {
  id: string;
  role: "donor" | "requester";
  conversationId: string | null;
  listingTitle: string;
  requestTitle: string;
  otherId: string;
  otherFirstName: string;
  createdAt: Date;
}

export async function getActiveMatches(userId: string): Promise<DashboardMatch[]> {
  const rows = await prisma.match.findMany({
    where: { status: "ACTIVE", OR: [{ donorId: userId }, { requesterId: userId }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      donorId: true,
      requesterId: true,
      createdAt: true,
      conversation: { select: { id: true } },
      listing: { select: { title: true } },
      request: { select: { title: true } },
      donor: { select: { firstName: true } },
      requester: { select: { firstName: true } },
    },
  });
  return rows.map((m) => {
    const role = m.donorId === userId ? "donor" : "requester";
    return {
      id: m.id,
      role,
      conversationId: m.conversation?.id ?? null,
      listingTitle: m.listing.title,
      requestTitle: m.request.title,
      otherId: role === "donor" ? m.requesterId : m.donorId,
      otherFirstName: role === "donor" ? m.requester.firstName : m.donor.firstName,
      createdAt: m.createdAt,
    };
  });
}

/** Profile fields the better-auth session does not expose. */
export function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true, idVerified: true, restrictedAt: true },
  });
}

/** Full record for the edit form. Caller must still check ownership. */
export function getListingForEdit(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: { spec: { select: { hasCharger: true, hasKeyboard: true } } },
  });
}

export function getRequestForEdit(id: string) {
  return prisma.request.findUnique({ where: { id } });
}

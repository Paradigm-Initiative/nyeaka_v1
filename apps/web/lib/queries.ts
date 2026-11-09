import { prisma } from "@/neon-db";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type BrowseFilters } from "./browse-params";

// Only live posts are public: ACTIVE and not past expiresAt.
const live = () => ({ status: "ACTIVE" as const, expiresAt: { gt: new Date() } });

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

export function getRecentListings(take = 3): Promise<ListingCardData[]> {
  return prisma.listing.findMany({
    where: live(),
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

export async function getLiveListings(f: BrowseFilters): Promise<Paged<ListingCardData>> {
  const where: Prisma.ListingWhereInput = {
    ...live(),
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

export async function getLiveRequests(f: BrowseFilters): Promise<Paged<RequestCardData>> {
  const where: Prisma.RequestWhereInput = {
    ...live(),
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

export async function getListingDetail(id: string) {
  const listing = await prisma.listing.findFirst({
    where: { id, status: { in: ["ACTIVE", "MATCHED"] } },
    include: { spec: true, donor: { select: { id: true, firstName: true } } },
  });
  if (!listing) return null;
  return { listing, reputation: await getReputation(listing.donorId) };
}

export async function getRequestDetail(id: string) {
  const request = await prisma.request.findFirst({
    where: { id, status: { in: ["ACTIVE", "MATCHED"] } },
    include: { requester: { select: { id: true, firstName: true } } },
  });
  if (!request) return null;
  return { request, reputation: await getReputation(request.requesterId) };
}

export function getMyListings(userId: string) {
  return prisma.listing.findMany({
    where: { donorId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, city: true, area: true, condition: true, status: true, createdAt: true, _count: { select: { offers: true } } },
  });
}

export function getMyRequests(userId: string) {
  return prisma.request.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, city: true, area: true, minCondition: true, status: true, createdAt: true, _count: { select: { offers: true } } },
  });
}

export function getIncomingOffers(userId: string) {
  return prisma.offer.findMany({
    where: { status: "PENDING", listing: { donorId: userId } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      message: true,
      createdAt: true,
      listing: { select: { title: true } },
      request: { select: { description: true, city: true, area: true, requester: { select: { firstName: true, idVerified: true } } } },
    },
  });
}

/** Profile fields the better-auth session does not expose. */
export function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true, idVerified: true },
  });
}

import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";

/**
 * Rate limits that count a user's recent rows instead of keeping counters.
 *
 * There is no Redis, and an in-memory limiter doesn't work on serverless where
 * each request can land on a different instance. The tables already record who
 * did what and when, so "N in the last W seconds" is a count on an indexed
 * range. Nothing new to store, and every instance sees the same numbers.
 *
 * It is a soft limit: two requests in the same instant can both pass the count
 * and overshoot by one. That is fine for abuse control, not for billing.
 */
export interface RateRule {
  max: number;
  windowSeconds: number;
  /** Shown to the user: "You've hit the limit of {label}." */
  label: string;
}

interface Counter {
  /** Rows by this user created after `since`. */
  count(since: Date): Promise<number>;
  /** createdAt of the row `skip` places from the oldest one in the window. */
  nthOldest(since: Date, skip: number): Promise<Date | null>;
}

export const MESSAGE_RULES: RateRule[] = [
  { max: 20, windowSeconds: 60, label: "20 messages a minute" },
  { max: 500, windowSeconds: 86_400, label: "500 messages a day" },
];
export const OFFER_RULES: RateRule[] = [{ max: 10, windowSeconds: 86_400, label: "10 offers a day" }];
export const LISTING_RULES: RateRule[] = [{ max: 5, windowSeconds: 86_400, label: "5 new listings a day" }];
export const REQUEST_RULES: RateRule[] = [{ max: 5, windowSeconds: 86_400, label: "5 new requests a day" }];

export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * Throws RATE_LIMITED if any rule is full. When several are full, the wait is
 * the longest one, since the user can only act once all of them have cleared.
 */
export async function enforceRate(rules: RateRule[], counter: Counter): Promise<void> {
  const now = Date.now();
  let blocked: { rule: RateRule; waitSeconds: number } | null = null;

  for (const rule of rules) {
    const since = new Date(now - rule.windowSeconds * 1000);
    const used = await counter.count(since);
    if (used < rule.max) continue;

    // A slot frees when the (used - max + 1)th oldest row leaves the window.
    const freeing = await counter.nthOldest(since, used - rule.max);
    const freesAt = freeing ? freeing.getTime() + rule.windowSeconds * 1000 : now + rule.windowSeconds * 1000;
    const waitSeconds = (freesAt - now) / 1000;
    if (!blocked || waitSeconds > blocked.waitSeconds) blocked = { rule, waitSeconds };
  }

  if (blocked)
    throw new ServiceError(
      "RATE_LIMITED",
      `You've hit the limit of ${blocked.rule.label}. Try again in ${formatWait(blocked.waitSeconds)}.`,
    );
}

export const limitMessages = (userId: string) =>
  enforceRate(MESSAGE_RULES, {
    count: (since) => prisma.message.count({ where: { senderId: userId, createdAt: { gt: since } } }),
    nthOldest: async (since, skip) =>
      (
        await prisma.message.findFirst({
          where: { senderId: userId, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          skip,
          select: { createdAt: true },
        })
      )?.createdAt ?? null,
  });

export const limitOffers = (userId: string) =>
  enforceRate(OFFER_RULES, {
    count: (since) => prisma.offer.count({ where: { initiatedById: userId, createdAt: { gt: since } } }),
    nthOldest: async (since, skip) =>
      (
        await prisma.offer.findFirst({
          where: { initiatedById: userId, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          skip,
          select: { createdAt: true },
        })
      )?.createdAt ?? null,
  });

export const limitListings = (userId: string) =>
  enforceRate(LISTING_RULES, {
    count: (since) => prisma.listing.count({ where: { donorId: userId, createdAt: { gt: since } } }),
    nthOldest: async (since, skip) =>
      (
        await prisma.listing.findFirst({
          where: { donorId: userId, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          skip,
          select: { createdAt: true },
        })
      )?.createdAt ?? null,
  });

export const limitRequests = (userId: string) =>
  enforceRate(REQUEST_RULES, {
    count: (since) => prisma.request.count({ where: { requesterId: userId, createdAt: { gt: since } } }),
    nthOldest: async (since, skip) =>
      (
        await prisma.request.findFirst({
          where: { requesterId: userId, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          skip,
          select: { createdAt: true },
        })
      )?.createdAt ?? null,
  });

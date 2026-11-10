import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ServiceError } from "@/lib/errors";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});

import { prisma as _prisma } from "@/neon-db";
import { createOffer } from "@/lib/offers";
import { acceptOffer } from "@/lib/matches";
import { sendMessage } from "@/lib/messages";
import { createListing } from "@/lib/listings";
import { createRequest } from "@/lib/requests";
import { formatWait } from "@/lib/rate-limit";
import type { CreateListingInput, CreateRequestInput } from "@/validations/post-validation";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000);

let n = 0;
const user = (tag: string) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T` } });
const listing = (donorId: string) =>
  prisma.listing.create({
    data: {
      donorId, deviceType: "LAPTOP", title: "HP", description: "d", brand: "HP", model: "450",
      condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future(),
    },
  });
const request = (requesterId: string) =>
  prisma.request.create({
    data: { requesterId, title: "Need laptop", description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() },
  });

async function matched() {
  const [donor, req] = [await user("dee"), await user("rae")];
  const [l, r] = [await listing(donor.id), await request(req.id)];
  const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
  const { conversationId } = await acceptOffer(req.id, o.id);
  return { donor, req, conversationId };
}
/** Insert messages that were sent `ages` seconds ago, bypassing the limiter. */
const seedMessages = (conversationId: string, senderId: string, ages: number[]) =>
  prisma.message.createMany({
    data: ages.map((a, i) => ({ conversationId, senderId, body: `m${i}`, createdAt: ago(a) })),
  });
const rep = (len: number, age: number) => Array.from({ length: len }, () => age);

async function limited(p: Promise<unknown>, msg: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe("RATE_LIMITED");
  expect((err as ServiceError).message).toMatch(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Message","Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

describe("formatWait", () => {
  it("rounds up and picks a readable unit", () => {
    expect(formatWait(0.2)).toBe("1 second");
    expect(formatWait(1)).toBe("1 second");
    expect(formatWait(59)).toBe("59 seconds");
    expect(formatWait(61)).toBe("2 minutes");
    expect(formatWait(1800)).toBe("30 minutes");
    expect(formatWait(3599)).toBe("1 hour");
    expect(formatWait(7300)).toBe("3 hours");
  });
});

describe("messages", () => {
  it("allows 20 a minute, blocks the 21st, and says when to retry", async () => {
    const { donor, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, rep(20, 50));

    await limited(sendMessage(donor.id, conversationId, { body: "one more" }), /20 messages a minute.*Try again in (9|10) seconds/);
    expect(await prisma.message.count()).toBe(20); // nothing was written
  });

  it("allows 19 a minute", async () => {
    const { donor, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, rep(19, 30));
    await sendMessage(donor.id, conversationId, { body: "the 20th" });
    expect(await prisma.message.count()).toBe(20);
  });

  it("frees up once the window has passed", async () => {
    const { donor, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, rep(20, 61));
    await sendMessage(donor.id, conversationId, { body: "fine now" });
  });

  it("is per user: the other person in the chat is unaffected", async () => {
    const { donor, req, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, rep(20, 10));
    await limited(sendMessage(donor.id, conversationId, { body: "x" }), /20 messages a minute/);
    await sendMessage(req.id, conversationId, { body: "I can still write" });
  });

  it("applies a daily cap too, with a long wait", async () => {
    const { donor, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, rep(500, 23.5 * 3600));
    await limited(sendMessage(donor.id, conversationId, { body: "x" }), /500 messages a day.*Try again in 30 minutes/);
  });

  it("when both limits are full the longest wait is reported", async () => {
    const { donor, conversationId } = await matched();
    await seedMessages(conversationId, donor.id, [...rep(500, 23.5 * 3600), ...rep(20, 5)]);
    await limited(sendMessage(donor.id, conversationId, { body: "x" }), /500 messages a day.*30 minutes/);
  });

  it("if a race overshoots the limit, waits for enough rows to expire", async () => {
    const { donor, conversationId } = await matched();
    // 22 messages in the last minute: the user must wait until 3 of them age out.
    const ages = Array.from({ length: 22 }, (_, i) => 59 - i); // 59s, 58s, 57s ... 38s ago
    await seedMessages(conversationId, donor.id, ages);
    await limited(sendMessage(donor.id, conversationId, { body: "x" }), /Try again in (2|3) seconds/);
  });

  it("does not let validation errors or strangers consume the allowance", async () => {
    const { donor, conversationId } = await matched();
    await expect(sendMessage(donor.id, conversationId, { body: "  " })).rejects.toThrow();
    expect(await prisma.message.count()).toBe(0);
  });
});

describe("offers", () => {
  it("allows 10 a day, blocks the 11th, and says when the oldest one expires", async () => {
    const [donor, requester] = [await user("d"), await user("r")];
    const target = await listing(donor.id);
    const requests = await Promise.all(Array.from({ length: 12 }, () => request(requester.id)));
    const base = { listingId: target.id, donorId: donor.id, initiatedById: donor.id, status: "DECLINED" as const };

    // 9 sent an hour ago, then the 10th through the service: the 11th must wait for the oldest to age out.
    await prisma.offer.createMany({ data: requests.slice(0, 9).map((r) => ({ ...base, requestId: r.id, createdAt: ago(3600) })) });
    const other = await listing(donor.id);
    await createOffer(donor.id, { listingId: other.id, requestId: requests[9].id }); // the 10th is fine

    const third = await listing(donor.id);
    await limited(createOffer(donor.id, { listingId: third.id, requestId: requests[10].id }), /10 offers a day.*Try again in 23 hours/);
  });

  it("older than a day does not count, and other users are unaffected", async () => {
    const [donor, other, requester] = [await user("d"), await user("o"), await user("r")];
    const target = await listing(donor.id);
    const rs = await Promise.all(Array.from({ length: 11 }, () => request(requester.id)));
    await prisma.offer.createMany({
      data: rs.slice(0, 10).map((r) => ({
        listingId: target.id, requestId: r.id, donorId: donor.id, initiatedById: donor.id, status: "DECLINED" as const,
        createdAt: ago(86_400 + 60),
      })),
    });
    const fresh = await listing(donor.id);
    await createOffer(donor.id, { listingId: fresh.id, requestId: rs[10].id }); // old ones expired

    const otherListing = await listing(other.id);
    await createOffer(other.id, { listingId: otherListing.id, requestId: rs[0].id });
  });

  it("counts offers the user sent as a requester too", async () => {
    const [donor, requester] = [await user("d"), await user("r")];
    const listings = await Promise.all(Array.from({ length: 11 }, () => listing(donor.id)));
    const mine = await request(requester.id);
    await prisma.offer.createMany({
      data: listings.slice(0, 10).map((l) => ({
        listingId: l.id, requestId: mine.id, donorId: donor.id, initiatedById: requester.id, status: "DECLINED" as const,
      })),
    });
    // a different request so the pair is new
    const another = await request(requester.id);
    await limited(createOffer(requester.id, { listingId: listings[10].id, requestId: another.id }), /10 offers a day/);
  });
});

describe("new posts", () => {
  const listingInput: CreateListingInput = { deviceType: "LAPTOP", brand: "HP", model: "450", condition: "GOOD", city: "Lagos", countryCode: "NG", photos: [] };
  const requestInput: CreateRequestInput = { deviceType: "LAPTOP", title: "Need a laptop", description: "For my studies this term", city: "Lagos", countryCode: "NG", pledge: true };

  it("limits new listings to 5 a day", async () => {
    const donor = await user("d");
    for (let i = 0; i < 4; i++) await listing(donor.id);
    await createListing(donor.id, listingInput); // the 5th
    await limited(createListing(donor.id, listingInput), /5 new listings a day/);
    expect(await prisma.listing.count({ where: { donorId: donor.id } })).toBe(5);
  });

  it("limits new requests to 5 a day", async () => {
    const req = await user("r");
    for (let i = 0; i < 4; i++) await request(req.id);
    await createRequest(req.id, requestInput);
    await limited(createRequest(req.id, requestInput), /5 new requests a day/);
    expect(await prisma.request.count({ where: { requesterId: req.id } })).toBe(5);
  });

  it("listing and request allowances are separate", async () => {
    const u = await user("both");
    for (let i = 0; i < 5; i++) await listing(u.id);
    await createRequest(u.id, requestInput);
  });
});

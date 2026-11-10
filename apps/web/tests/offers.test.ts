import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ServiceError } from "@/lib/errors";

// Point the app's prisma import at an in-process Postgres with the real migrations.
const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});

import { prisma as _prisma } from "@/neon-db";
import { createOffer, withdrawOffer } from "@/lib/offers";

const prisma = _prisma as unknown as PrismaClient;
const day = 86_400_000;
const future = () => new Date(Date.now() + 30 * day);

let n = 0;
const user = (tag: string) =>
  prisma.user.create({
    data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T` },
  });
const listing = (donorId: string, extra: Record<string, unknown> = {}) =>
  prisma.listing.create({
    data: {
      donorId, deviceType: "LAPTOP", title: "HP", description: "d", brand: "HP",
      model: "450", condition: "GOOD", countryCode: "NG", city: "Lagos",
      expiresAt: future(), ...extra,
    },
  });
const request = (requesterId: string, extra: Record<string, unknown> = {}) =>
  prisma.request.create({
    data: {
      requesterId, title: "Need laptop", description: "d", countryCode: "NG",
      city: "Lagos", expiresAt: future(), ...extra,
    },
  });

async function rejects(p: Promise<unknown>, code: string, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toMatch(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Offer","Match","Listing","Request","user" CASCADE',
  );
});
afterAll(() => testDb.stop());

describe("createOffer", () => {
  it("donor offers a device on a request", async () => {
    const [donor, req] = [await user("donor"), await user("req")];
    const l = await listing(donor.id);
    const r = await request(req.id);

    const { id } = await createOffer(donor.id, { listingId: l.id, requestId: r.id, message: "  hi  " });
    const row = await prisma.offer.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({
      donorId: donor.id, initiatedById: donor.id, status: "PENDING", message: "hi",
    });
  });

  it("requester can ask for a device from the listing page", async () => {
    const [donor, req] = [await user("donor"), await user("req")];
    const l = await listing(donor.id);
    const r = await request(req.id);

    const { id } = await createOffer(req.id, { listingId: l.id, requestId: r.id });
    const row = await prisma.offer.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ donorId: donor.id, initiatedById: req.id });
  });

  it("rejects offering on your own post", async () => {
    const me = await user("me");
    const l = await listing(me.id);
    const r = await request(me.id);
    await rejects(createOffer(me.id, { listingId: l.id, requestId: r.id }), "INVALID", /own post/);
  });

  it("rejects a user who owns neither side", async () => {
    const [donor, req, stranger] = [await user("d"), await user("r"), await user("s")];
    const l = await listing(donor.id);
    const r = await request(req.id);
    await rejects(createOffer(stranger.id, { listingId: l.id, requestId: r.id }), "FORBIDDEN");
  });

  it("404s on unknown listing or request", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const l = await listing(donor.id);
    const r = await request(req.id);
    await rejects(createOffer(donor.id, { listingId: "nope", requestId: r.id }), "NOT_FOUND");
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: "nope" }), "NOT_FOUND");
  });

  it("allows only one active offer per donor and request", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(req.id);

    await createOffer(donor.id, { listingId: l1.id, requestId: r.id });
    await rejects(
      createOffer(donor.id, { listingId: l2.id, requestId: r.id }),
      "INVALID", /already have an active offer/,
    );
  });

  it("counts a requester-initiated offer against the donor's one-offer limit", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(req.id);

    await createOffer(req.id, { listingId: l1.id, requestId: r.id });
    await rejects(createOffer(donor.id, { listingId: l2.id, requestId: r.id }), "INVALID", /active offer/);
  });

  it("lets different donors offer on the same request", async () => {
    const [d1, d2, req] = [await user("d1"), await user("d2"), await user("r")];
    const r = await request(req.id);
    await createOffer(d1.id, { listingId: (await listing(d1.id)).id, requestId: r.id });
    await createOffer(d2.id, { listingId: (await listing(d2.id)).id, requestId: r.id });
    expect(await prisma.offer.count({ where: { requestId: r.id } })).toBe(2);
  });

  it("lets a donor offer the same device on different requests", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const l = await listing(donor.id);
    await createOffer(donor.id, { listingId: l.id, requestId: (await request(req.id)).id });
    await createOffer(donor.id, { listingId: l.id, requestId: (await request(req.id)).id });
  });

  it("frees the donor to offer again after withdrawing, but not the same device", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(req.id);

    const first = await createOffer(donor.id, { listingId: l1.id, requestId: r.id });
    await withdrawOffer(donor.id, first.id);

    await rejects(createOffer(donor.id, { listingId: l1.id, requestId: r.id }), "INVALID", /already offered/);
    await createOffer(donor.id, { listingId: l2.id, requestId: r.id });
  });

  it("rejects matched, closed and expired posts", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const l = await listing(donor.id);
    const l2 = await listing(donor.id);

    const matched = await request(req.id, { status: "MATCHED" });
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: matched.id }), "INVALID", /no longer open/);

    const expired = await request(req.id, { expiresAt: new Date(Date.now() - day) });
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: expired.id }), "INVALID", /no longer open/);

    const live = await request(req.id);
    const closed = await listing(donor.id, { status: "CLOSED" });
    await rejects(createOffer(req.id, { listingId: closed.id, requestId: live.id }), "INVALID", /no longer available/);
    void l2;
  });

  it("validates input", async () => {
    const donor = await user("d");
    await expect(createOffer(donor.id, { listingId: "", requestId: "x" })).rejects.toThrow();
    await expect(
      createOffer(donor.id, { listingId: "a", requestId: "b", message: "x".repeat(1001) }),
    ).rejects.toThrow();
  });

  it("two simultaneous offers from one donor produce exactly one", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(req.id);

    const results = await Promise.allSettled([
      createOffer(donor.id, { listingId: l1.id, requestId: r.id }),
      createOffer(donor.id, { listingId: l2.id, requestId: r.id }),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ServiceError);
    expect(await prisma.offer.count({ where: { requestId: r.id } })).toBe(1);
  });
});

describe("database guard", () => {
  it("partial unique index blocks a second PENDING offer even bypassing the service", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(req.id);
    const base = { requestId: r.id, donorId: donor.id, initiatedById: donor.id };

    await prisma.offer.create({ data: { ...base, listingId: l1.id } });
    await expect(prisma.offer.create({ data: { ...base, listingId: l2.id } })).rejects.toMatchObject({ code: "P2002" });

    // Once the first is no longer PENDING, a new one is allowed.
    await prisma.offer.updateMany({ where: { listingId: l1.id }, data: { status: "DECLINED" } });
    await prisma.offer.create({ data: { ...base, listingId: l2.id } });
  });
});

describe("withdrawOffer", () => {
  it("only the sender can withdraw, and only while PENDING", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const l = await listing(donor.id);
    const r = await request(req.id);
    const { id } = await createOffer(donor.id, { listingId: l.id, requestId: r.id });

    await rejects(withdrawOffer(req.id, id), "FORBIDDEN");
    await rejects(withdrawOffer(donor.id, "missing"), "NOT_FOUND");

    await withdrawOffer(donor.id, id);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id } })).status).toBe("WITHDRAWN");
    await rejects(withdrawOffer(donor.id, id), "INVALID", /already been answered/);
  });

  it("cannot withdraw an accepted offer", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const l = await listing(donor.id);
    const r = await request(req.id);
    const { id } = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    await prisma.offer.update({ where: { id }, data: { status: "ACCEPTED" } });
    await rejects(withdrawOffer(donor.id, id), "INVALID");
  });
});

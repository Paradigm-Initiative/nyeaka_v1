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
import { acceptOffer, cancelMatch, declineOffer } from "@/lib/matches";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);

let n = 0;
const user = (tag: string) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T` } });
const listing = (donorId: string, title = "HP") =>
  prisma.listing.create({
    data: {
      donorId, deviceType: "LAPTOP", title, description: "d", brand: "HP", model: "450",
      condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future(),
    },
  });
const request = (requesterId: string, title = "Need laptop") =>
  prisma.request.create({
    data: { requesterId, title, description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() },
  });
const offer = (by: string, l: string, r: string) => createOffer(by, { listingId: l, requestId: r });

async function rejects(p: Promise<unknown>, code: string, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toMatch(msg);
}
const status = async (kind: "listing" | "request" | "offer" | "match", id: string) => {
  const where = { where: { id }, select: { status: true } } as const;
  switch (kind) {
    case "listing": return (await prisma.listing.findUniqueOrThrow(where)).status;
    case "request": return (await prisma.request.findUniqueOrThrow(where)).status;
    case "offer": return (await prisma.offer.findUniqueOrThrow(where)).status;
    case "match": return (await prisma.match.findUniqueOrThrow(where)).status;
  }
};

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

describe("acceptOffer", () => {
  it("requester accepts a donor's offer: match, conversation, both posts MATCHED", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);

    const res = await acceptOffer(req.id, o.id);

    expect(await status("offer", o.id)).toBe("ACCEPTED");
    expect(await status("listing", l.id)).toBe("MATCHED");
    expect(await status("request", r.id)).toBe("MATCHED");
    const match = await prisma.match.findUniqueOrThrow({ where: { id: res.matchId }, include: { conversation: true } });
    expect(match).toMatchObject({
      offerId: o.id, donorId: donor.id, requesterId: req.id, listingId: l.id, requestId: r.id, status: "ACTIVE",
    });
    expect(match.conversation?.id).toBe(res.conversationId);
    expect(res.offerSenderId).toBe(donor.id);
    expect(res.notSelected).toEqual([]);
  });

  it("donor accepts a requester-initiated offer", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(req.id, l.id, r.id);

    const res = await acceptOffer(donor.id, o.id);
    expect(res.offerSenderId).toBe(req.id);
    expect(await status("offer", o.id)).toBe("ACCEPTED");
  });

  it("only the receiving side may accept", async () => {
    const [donor, req, stranger] = [await user("d"), await user("r"), await user("s")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);

    await rejects(acceptOffer(donor.id, o.id), "FORBIDDEN"); // the sender
    await rejects(acceptOffer(stranger.id, o.id), "FORBIDDEN");
    await rejects(acceptOffer(req.id, "missing"), "NOT_FOUND");
    expect(await status("offer", o.id)).toBe("PENDING");
    expect(await prisma.match.count()).toBe(0);
  });

  it("declines the other offers on the same request and the same device, and reports who to tell", async () => {
    const [d1, d2, q1, q2, q3, d3] = await Promise.all(["d1", "d2", "q1", "q2", "q3", "d3"].map(user));
    const [l1, l2, l3] = [await listing(d1.id, "L1"), await listing(d2.id, "L2"), await listing(d3.id, "L3")];
    const [r1, r2, r3] = [await request(q1.id, "R1"), await request(q2.id, "R2"), await request(q3.id, "R3")];

    const winning = await offer(d1.id, l1.id, r1.id);
    const rival = await offer(d2.id, l2.id, r1.id); // another donor, same request
    const sameDevice = await offer(d1.id, l1.id, r2.id); // same device, other request
    const asked = await offer(q3.id, l1.id, r3.id); // another requester asking for the same device
    const unrelated = await offer(d3.id, l3.id, r2.id);

    const res = await acceptOffer(q1.id, winning.id);

    for (const o of [rival, sameDevice, asked]) expect(await status("offer", o.id)).toBe("DECLINED");
    expect(await status("offer", unrelated.id)).toBe("PENDING");
    expect(await status("request", r2.id)).toBe("ACTIVE");
    expect(await status("listing", l2.id)).toBe("ACTIVE");

    const byOffer = Object.fromEntries(res.notSelected.map((x) => [x.offerId, x]));
    expect(res.notSelected).toHaveLength(3);
    expect(byOffer[rival.id]).toMatchObject({ recipientId: d2.id, recipientRole: "donor", listingTitle: "L2", requestTitle: "R1" });
    expect(byOffer[sameDevice.id]).toMatchObject({ recipientId: q2.id, recipientRole: "requester", listingTitle: "L1", requestTitle: "R2" });
    expect(byOffer[asked.id]).toMatchObject({ recipientId: q3.id, recipientRole: "requester" });
  });

  it("cannot be accepted twice, and a rival offer is dead after the first accept", async () => {
    const [d1, d2, req] = [await user("d1"), await user("d2"), await user("r")];
    const [l1, l2, r] = [await listing(d1.id), await listing(d2.id), await request(req.id)];
    const a = await offer(d1.id, l1.id, r.id);
    const b = await offer(d2.id, l2.id, r.id);

    await acceptOffer(req.id, a.id);
    await rejects(acceptOffer(req.id, a.id), "INVALID", /already been answered/);
    await rejects(acceptOffer(req.id, b.id), "INVALID", /already been answered/);
    expect(await prisma.match.count()).toBe(1);
  });

  it("refuses when a post is no longer live", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);
    await prisma.listing.update({ where: { id: l.id }, data: { status: "CLOSED" } });

    await rejects(acceptOffer(req.id, o.id), "INVALID", /no longer available/);
    await prisma.listing.update({ where: { id: l.id }, data: { status: "ACTIVE", expiresAt: new Date(Date.now() - 1000) } });
    await rejects(acceptOffer(req.id, o.id), "INVALID", /no longer available/);
    expect(await status("offer", o.id)).toBe("PENDING");
  });

  it("rolls everything back if a later step fails", async () => {
    const [donor, req, other] = [await user("d"), await user("r"), await user("o")];
    const [l, r, otherReq] = [await listing(donor.id), await request(req.id), await request(other.id)];
    const o = await offer(donor.id, l.id, r.id);
    const sibling = await offer(donor.id, l.id, otherReq.id);
    // Corrupt state on purpose: a match already exists for this offer, so match.create will fail
    // after the offer/listing/request updates have already run inside the transaction.
    await prisma.match.create({
      data: { offerId: o.id, donorId: donor.id, requesterId: req.id, listingId: l.id, requestId: r.id },
    });

    await expect(acceptOffer(req.id, o.id)).rejects.toBeTruthy();

    expect(await status("offer", o.id)).toBe("PENDING");
    expect(await status("offer", sibling.id)).toBe("PENDING");
    expect(await status("listing", l.id)).toBe("ACTIVE");
    expect(await status("request", r.id)).toBe("ACTIVE");
  });
});

describe("declineOffer", () => {
  it("receiver declines; nothing else changes", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);

    await rejects(declineOffer(donor.id, o.id), "FORBIDDEN");
    const res = await declineOffer(req.id, o.id);
    expect(res.offerSenderId).toBe(donor.id);
    expect(await status("offer", o.id)).toBe("DECLINED");
    expect(await status("listing", l.id)).toBe("ACTIVE");
    expect(await status("request", r.id)).toBe("ACTIVE");
    await rejects(declineOffer(req.id, o.id), "INVALID", /already been answered/);
    await rejects(declineOffer(req.id, "missing"), "NOT_FOUND");
  });

  it("cannot decline an accepted offer", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);
    await acceptOffer(req.id, o.id);
    await rejects(declineOffer(req.id, o.id), "INVALID");
    expect(await status("offer", o.id)).toBe("ACCEPTED");
  });
});

describe("cancelMatch", () => {
  async function matched() {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);
    const { matchId } = await acceptOffer(req.id, o.id);
    return { donor, req, l, r, o, matchId };
  }

  it("either participant cancels: match CANCELLED, listing and request back to ACTIVE", async () => {
    const { donor, req, l, r, o, matchId } = await matched();

    const res = await cancelMatch(donor.id, matchId);

    expect(res.otherPartyId).toBe(req.id);
    expect(await status("match", matchId)).toBe("CANCELLED");
    expect(await status("listing", l.id)).toBe("ACTIVE");
    expect(await status("request", r.id)).toBe("ACTIVE");
    expect(await status("offer", o.id)).toBe("ACCEPTED"); // history preserved
  });

  it("the other participant can cancel too", async () => {
    const { donor, req, matchId } = await matched();
    expect((await cancelMatch(req.id, matchId)).otherPartyId).toBe(donor.id);
  });

  it("strangers cannot cancel; a match cannot be cancelled twice or after handover", async () => {
    const { donor, matchId } = await matched();
    const stranger = await user("s");
    await rejects(cancelMatch(stranger.id, matchId), "FORBIDDEN");
    await rejects(cancelMatch(donor.id, "missing"), "NOT_FOUND");

    await cancelMatch(donor.id, matchId);
    await rejects(cancelMatch(donor.id, matchId), "INVALID", /active match/);

    const second = await matched();
    await prisma.match.update({ where: { id: second.matchId }, data: { status: "HANDED_OVER" } });
    await rejects(cancelMatch(second.donor.id, second.matchId), "INVALID");
    expect(await status("listing", second.l.id)).toBe("MATCHED");
  });

  it("frees the request for a new donor, but earlier declined offers stay declined", async () => {
    const [d1, d2, req] = [await user("d1"), await user("d2"), await user("r")];
    const [l1, l2, r] = [await listing(d1.id), await listing(d2.id), await request(req.id)];
    const winning = await offer(d1.id, l1.id, r.id);
    const rival = await offer(d2.id, l2.id, r.id);
    const { matchId } = await acceptOffer(req.id, winning.id);
    expect(await status("offer", rival.id)).toBe("DECLINED");

    await cancelMatch(req.id, matchId);

    expect(await status("offer", rival.id)).toBe("DECLINED");
    // d2 already had its offer on this request resolved, so they can send a different device.
    const l3 = await listing(d2.id);
    const fresh = await offer(d2.id, l3.id, r.id);
    await acceptOffer(req.id, fresh.id);
    expect(await status("request", r.id)).toBe("MATCHED");
  });
});

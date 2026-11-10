import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});

import { prisma as _prisma } from "@/neon-db";
import { createOffer, withdrawOffer } from "@/lib/offers";
import { acceptOffer, cancelMatch, declineOffer } from "@/lib/matches";
import { getListingOfferContext, getRequestOfferContext } from "@/lib/offer-queries";
import { getActiveMatches, getDashboardOffers, getMyListings, getMyRequests } from "@/lib/queries";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);

let n = 0;
const user = (tag: string) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T` } });
const listing = (donorId: string, title = "HP", extra: Record<string, unknown> = {}) =>
  prisma.listing.create({
    data: {
      donorId, deviceType: "LAPTOP", title, description: "d", brand: "HP", model: "450",
      condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future(), ...extra,
    },
  });
const request = (requesterId: string, title = "Need laptop", extra: Record<string, unknown> = {}) =>
  prisma.request.create({
    data: { requesterId, title, description: "why", countryCode: "NG", city: "Lagos", area: "Yaba", expiresAt: future(), ...extra },
  });
const offer = (by: string, l: string, r: string, message?: string) =>
  createOffer(by, { listingId: l, requestId: r, message });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

describe("getListingOfferContext (viewer asks for a device with a request)", () => {
  it("lists only the viewer's live requests", async () => {
    const [donor, me, other] = [await user("d"), await user("me"), await user("o")];
    const l = await listing(donor.id);
    const mine = await request(me.id, "Mine");
    await request(me.id, "Closed", { status: "CLOSED" });
    await request(me.id, "Expired", { expiresAt: new Date(Date.now() - 1000) });
    await request(other.id, "Not mine");

    const ctx = await getListingOfferContext(me.id, l.id, donor.id);
    expect(ctx.options).toEqual([{ id: mine.id, title: "Mine", place: "Yaba, Lagos", blocked: null }]);
    expect(ctx.pending).toBeNull();
    expect(ctx.locked).toBe(false);
  });

  it("blocks a request already used with this device and surfaces the pending offer", async () => {
    const [donor, me] = [await user("d"), await user("me")];
    const l = await listing(donor.id);
    const [r1, r2] = [await request(me.id, "R1"), await request(me.id, "R2")];
    const sent = await offer(me.id, l.id, r1.id);

    const ctx = await getListingOfferContext(me.id, l.id, donor.id);
    const by = Object.fromEntries(ctx.options.map((o) => [o.id, o.blocked]));
    expect(by[r1.id]).toBe("Offer already sent");
    expect(by[r2.id]).toBeNull();
    expect(ctx.pending).toEqual({ id: sent.id, initiatedByMe: true, yourPost: "R1" });
  });

  it("marks a donor-initiated pending offer as not mine", async () => {
    const [donor, me] = [await user("d"), await user("me")];
    const l = await listing(donor.id);
    const r = await request(me.id, "R1");
    await offer(donor.id, l.id, r.id);

    const ctx = await getListingOfferContext(me.id, l.id, donor.id);
    expect(ctx.pending?.initiatedByMe).toBe(false);
  });

  it("blocks a request where this donor already has a pending offer with another device", async () => {
    const [donor, me] = [await user("d"), await user("me")];
    const [l1, l2] = [await listing(donor.id), await listing(donor.id)];
    const r = await request(me.id);
    await offer(donor.id, l1.id, r.id);

    const ctx = await getListingOfferContext(me.id, l2.id, donor.id);
    expect(ctx.options[0].blocked).toMatch(/already has an offer/);
  });

  it("shows declined and withdrawn history as blocked, not pending", async () => {
    const [donor, me] = [await user("d"), await user("me")];
    const l = await listing(donor.id);
    const [r1, r2] = [await request(me.id, "R1"), await request(me.id, "R2")];
    const a = await offer(donor.id, l.id, r1.id);
    await declineOffer(me.id, a.id);
    const b = await offer(me.id, l.id, r2.id);
    await withdrawOffer(me.id, b.id);

    const ctx = await getListingOfferContext(me.id, l.id, donor.id);
    const by = Object.fromEntries(ctx.options.map((o) => [o.id, o.blocked]));
    expect(by[r1.id]).toMatch(/declined/);
    expect(by[r2.id]).toMatch(/withdrawn/);
    expect(ctx.pending).toBeNull();
  });
});

describe("getRequestOfferContext (viewer offers a device on a request)", () => {
  it("lists the viewer's live listings", async () => {
    const [me, req] = [await user("me"), await user("r")];
    const r = await request(req.id);
    const mine = await listing(me.id, "Mine");
    await listing(me.id, "Closed", { status: "CLOSED" });
    await listing(me.id, "Matched", { status: "MATCHED" });

    const ctx = await getRequestOfferContext(me.id, r.id);
    expect(ctx.options.map((o) => o.id)).toEqual([mine.id]);
    expect(ctx.locked).toBe(false);
  });

  it("locks the form once the donor has a pending offer on the request", async () => {
    const [me, req] = [await user("me"), await user("r")];
    const r = await request(req.id);
    const l = await listing(me.id, "Sent one");
    await listing(me.id, "Spare");
    const sent = await offer(me.id, l.id, r.id);

    const ctx = await getRequestOfferContext(me.id, r.id);
    expect(ctx.locked).toBe(true);
    expect(ctx.pending).toEqual({ id: sent.id, initiatedByMe: true, yourPost: "Sent one" });
  });

  it("unlocks after a withdraw but keeps that device blocked", async () => {
    const [me, req] = [await user("me"), await user("r")];
    const r = await request(req.id);
    const [l1, l2] = [await listing(me.id, "L1"), await listing(me.id, "L2")];
    const sent = await offer(me.id, l1.id, r.id);
    await withdrawOffer(me.id, sent.id);

    const ctx = await getRequestOfferContext(me.id, r.id);
    expect(ctx.locked).toBe(false);
    const by = Object.fromEntries(ctx.options.map((o) => [o.id, o.blocked]));
    expect(by[l1.id]).toMatch(/withdrawn/);
    expect(by[l2.id]).toBeNull();
  });
});

describe("getDashboardOffers", () => {
  it("splits received from sent for each role, with the other person's details", async () => {
    const [alex, bo] = [await user("alex"), await user("bo")];
    await prisma.user.update({ where: { id: bo.id }, data: { idVerified: true } });
    const aLap = await listing(alex.id, "Alex laptop");
    const aReq = await request(alex.id, "Alex needs tablet");
    const bLap = await listing(bo.id, "Bo laptop");
    const bReq = await request(bo.id, "Bo needs laptop");

    const sentAsDonor = await offer(alex.id, aLap.id, bReq.id, "Take it");
    const receivedAsDonor = await offer(bo.id, aLap.id, (await request(bo.id, "Second")).id);
    const receivedAsRequester = await offer(bo.id, bLap.id, aReq.id);

    const list = await getDashboardOffers(alex.id);
    const byId = Object.fromEntries(list.map((o) => [o.id, o]));

    expect(byId[sentAsDonor.id]).toMatchObject({
      role: "donor", direction: "sent", status: "PENDING", message: "Take it",
      listingTitle: "Alex laptop", requestTitle: "Bo needs laptop",
      place: "Yaba, Lagos", other: { firstName: "bo", idVerified: true },
    });
    expect(byId[receivedAsDonor.id]).toMatchObject({ role: "donor", direction: "received", other: { firstName: "bo" } });
    expect(byId[receivedAsRequester.id]).toMatchObject({
      role: "requester", direction: "received", listingTitle: "Bo laptop", other: { firstName: "bo" },
    });
    expect(list).toHaveLength(3);
  });

  it("shows declined offers only to their sender, and hides accepted and withdrawn", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l1, l2, l3] = [await listing(donor.id, "L1"), await listing(donor.id, "L2"), await listing(donor.id, "L3")];
    const [r1, r2, r3] = [await request(req.id, "R1"), await request(req.id, "R2"), await request(req.id, "R3")];

    const declined = await offer(donor.id, l1.id, r1.id);
    await declineOffer(req.id, declined.id);
    const accepted = await offer(donor.id, l2.id, r2.id);
    await acceptOffer(req.id, accepted.id);
    const withdrawn = await offer(donor.id, l3.id, r3.id);
    await withdrawOffer(donor.id, withdrawn.id);

    const donorView = await getDashboardOffers(donor.id);
    expect(donorView.map((o) => [o.id, o.status])).toEqual([[declined.id, "DECLINED"]]);
    expect(await getDashboardOffers(req.id)).toEqual([]); // the receiver doesn't see offers they turned down
  });

  it("does not show other people's offers", async () => {
    const [a, b, c] = [await user("a"), await user("b"), await user("c")];
    await offer(a.id, (await listing(a.id)).id, (await request(b.id)).id);
    expect(await getDashboardOffers(c.id)).toEqual([]);
  });
});

describe("getActiveMatches", () => {
  it("returns the viewer's ACTIVE matches with chat id and counterpart, from each side", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, "Lap"), await request(req.id, "Need")];
    const o = await offer(donor.id, l.id, r.id);
    const { matchId, conversationId } = await acceptOffer(req.id, o.id);

    expect(await getActiveMatches(donor.id)).toEqual([
      expect.objectContaining({ id: matchId, role: "donor", conversationId, otherFirstName: "rae", listingTitle: "Lap", requestTitle: "Need" }),
    ]);
    expect(await getActiveMatches(req.id)).toEqual([
      expect.objectContaining({ id: matchId, role: "requester", otherFirstName: "dee" }),
    ]);
    expect(await getActiveMatches((await user("x")).id)).toEqual([]);
  });

  it("drops cancelled and handed-over matches", async () => {
    const [donor, req] = [await user("d"), await user("r")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    const o = await offer(donor.id, l.id, r.id);
    const { matchId } = await acceptOffer(req.id, o.id);

    await cancelMatch(donor.id, matchId);
    expect(await getActiveMatches(donor.id)).toEqual([]);

    await prisma.match.update({ where: { id: matchId }, data: { status: "HANDED_OVER" } });
    expect(await getActiveMatches(donor.id)).toEqual([]);
  });
});

describe("offer counts on the user's own posts", () => {
  it("count only PENDING offers", async () => {
    const [donor, q1, q2, q3] = [await user("d"), await user("q1"), await user("q2"), await user("q3")];
    const l = await listing(donor.id);
    const [r1, r2, r3] = [await request(q1.id), await request(q2.id), await request(q3.id)];
    await offer(donor.id, l.id, r1.id);
    const declined = await offer(q2.id, l.id, r2.id);
    await declineOffer(donor.id, declined.id);
    const withdrawn = await offer(q3.id, l.id, r3.id);
    await withdrawOffer(q3.id, withdrawn.id);

    const [row] = await getMyListings(donor.id);
    expect(row._count.offers).toBe(1);
    expect((await getMyRequests(q1.id))[0]._count.offers).toBe(1);
    expect((await getMyRequests(q2.id))[0]._count.offers).toBe(0);
  });
});

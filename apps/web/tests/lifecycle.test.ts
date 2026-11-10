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
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => "id") }));

import { prisma as _prisma } from "@/neon-db";
import { createOffer } from "@/lib/offers";
import { acceptOffer, cancelMatch } from "@/lib/matches";
import { getThread, sendMessage } from "@/lib/messages";
import { confirmHandoff, setPhoneShare } from "@/lib/handoff";
import { getMatchesToRate, rateMatch } from "@/lib/ratings";
import { blockUser } from "@/lib/safety";
import { getReputation } from "@/lib/queries";
import { normalizePhone } from "@/lib/phone";
import { ratingVerdict, RATING_WINDOW_DAYS } from "@/lib/rating-rules";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, ...extra } });

async function matched(donorExtra: Record<string, unknown> = {}, reqExtra: Record<string, unknown> = {}) {
  const [donor, req] = [await user("dee", donorExtra), await user("rae", reqExtra)];
  const l = await prisma.listing.create({
    data: {
      donorId: donor.id, deviceType: "LAPTOP", title: "Dell", description: "d", brand: "Dell", model: "5490",
      condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future(),
    },
  });
  const r = await prisma.request.create({
    data: { requesterId: req.id, title: "Need laptop", description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() },
  });
  const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
  const res = await acceptOffer(req.id, o.id);
  return { donor, req, ...res };
}
async function handedOver(extra?: { donor?: Record<string, unknown>; req?: Record<string, unknown> }) {
  const m = await matched(extra?.donor, extra?.req);
  await confirmHandoff(m.donor.id, m.matchId);
  await confirmHandoff(m.req.id, m.matchId);
  return m;
}

async function rejects(p: Promise<unknown>, code: string, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toMatch(msg);
}
const matchRow = (id: string) => prisma.match.findUniqueOrThrow({ where: { id } });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Rating","Report","Block","Message","Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

describe("normalizePhone", () => {
  it("strips separators and keeps a leading +", () => {
    expect(normalizePhone(" +234 (806) 412-0088 ")).toBe("+2348064120088");
    expect(normalizePhone("0806.412.0088")).toBe("08064120088");
  });
  it("rejects anything that is not 7 to 15 digits", () => {
    for (const bad of ["", "abc", "123456", "1234567890123456", "+23 48x064120088", "080-6412-0088-ext"])
      expect(() => normalizePhone(bad)).toThrow(ServiceError);
  });
});

describe("setPhoneShare", () => {
  it("needs a number: none on file and none given is refused", async () => {
    const m = await matched();
    await rejects(setPhoneShare(m.donor.id, m.matchId, true), "INVALID", /Add your phone number/);
    expect((await matchRow(m.matchId)).donorSharedPhone).toBe(false);
  });

  it("saves a typed number to the account (unverified) and records the choice", async () => {
    const m = await matched();
    await setPhoneShare(m.donor.id, m.matchId, true, "0806 412 0088");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: m.donor.id } });
    expect(u).toMatchObject({ phone: "08064120088", phoneVerified: false });
    expect(await matchRow(m.matchId)).toMatchObject({ donorSharedPhone: true, requesterSharedPhone: false });
  });

  it("uses the number on file, and a bad number changes nothing", async () => {
    const m = await matched({ phone: "+2348011111111" });
    await rejects(setPhoneShare(m.donor.id, m.matchId, true, "nope"), "INVALID", /valid phone number/);
    expect((await matchRow(m.matchId)).donorSharedPhone).toBe(false);
    await setPhoneShare(m.donor.id, m.matchId, true);
    expect((await matchRow(m.matchId)).donorSharedPhone).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: m.donor.id } })).phone).toBe("+2348011111111");
  });

  it("sets only the caller's own flag, and sharing can be withdrawn", async () => {
    const m = await matched({ phone: "+2348011111111" }, { phone: "+2348022222222" });
    await setPhoneShare(m.req.id, m.matchId, true);
    expect(await matchRow(m.matchId)).toMatchObject({ donorSharedPhone: false, requesterSharedPhone: true });
    await setPhoneShare(m.req.id, m.matchId, false);
    expect((await matchRow(m.matchId)).requesterSharedPhone).toBe(false);
  });

  it("is participants-only, closed once cancelled, and off while blocked", async () => {
    const m = await matched({ phone: "+2348011111111" });
    const stranger = await user("eve", { phone: "+2348033333333" });
    await rejects(setPhoneShare(stranger.id, m.matchId, true), "FORBIDDEN");
    await rejects(setPhoneShare(m.donor.id, "missing", true), "NOT_FOUND");

    await prisma.match.update({ where: { id: m.matchId }, data: { status: "HANDED_OVER" } });
    await prisma.block.create({ data: { blockerId: m.req.id, blockedId: m.donor.id } });
    await rejects(setPhoneShare(m.donor.id, m.matchId, true), "INVALID");
    await prisma.block.deleteMany();

    await prisma.match.update({ where: { id: m.matchId }, data: { status: "CANCELLED" } });
    await rejects(setPhoneShare(m.donor.id, m.matchId, true), "INVALID", /cancelled/);
  });
});

describe("phone visibility in the thread", () => {
  const A = "+2348011111111", B = "+2348022222222";

  it("reveals a number only when BOTH have opted in", async () => {
    const m = await matched({ phone: A }, { phone: B });

    let forDonor = await getThread(m.donor.id, m.conversationId);
    expect(forDonor.phone).toMatchObject({ available: true, hasMine: true, iShared: false, theyShared: false, theirNumber: null });

    await setPhoneShare(m.req.id, m.matchId, true);
    forDonor = await getThread(m.donor.id, m.conversationId);
    expect(forDonor.phone).toMatchObject({ iShared: false, theyShared: true, theirNumber: null });
    expect(JSON.stringify(forDonor)).not.toContain(B); // never sent to the page before the donor agrees

    await setPhoneShare(m.donor.id, m.matchId, true);
    forDonor = await getThread(m.donor.id, m.conversationId);
    const forReq = await getThread(m.req.id, m.conversationId);
    expect(forDonor.phone).toMatchObject({ iShared: true, theyShared: true, theirNumber: B });
    expect(forReq.phone).toMatchObject({ theirNumber: A });
    expect(JSON.stringify(forDonor)).not.toContain(A); // own number isn't echoed back either

    await setPhoneShare(m.req.id, m.matchId, false);
    expect((await getThread(m.donor.id, m.conversationId)).phone.theirNumber).toBeNull();
  });

  it("is switched off after a cancel or a block, even if both had opted in", async () => {
    const m = await matched({ phone: A }, { phone: B });
    await setPhoneShare(m.donor.id, m.matchId, true);
    await setPhoneShare(m.req.id, m.matchId, true);
    expect((await getThread(m.donor.id, m.conversationId)).phone.theirNumber).toBe(B);

    await cancelMatch(m.donor.id, m.matchId);
    const after = await getThread(m.donor.id, m.conversationId);
    expect(after.phone).toMatchObject({ available: false, theirNumber: null });
    expect(JSON.stringify(after)).not.toContain(B);
  });
});

describe("confirmHandoff", () => {
  it("needs both people; one confirmation leaves the match active", async () => {
    const m = await matched();
    expect(await confirmHandoff(m.donor.id, m.matchId)).toEqual({ handedOver: false });
    expect((await matchRow(m.matchId)).status).toBe("ACTIVE");

    expect((await getThread(m.donor.id, m.conversationId)).handoff).toEqual({ iConfirmed: true, theyConfirmed: false });
    expect((await getThread(m.req.id, m.conversationId)).handoff).toEqual({ iConfirmed: false, theyConfirmed: true });

    expect(await confirmHandoff(m.req.id, m.matchId)).toEqual({ handedOver: true });
    const row = await matchRow(m.matchId);
    expect(row.status).toBe("HANDED_OVER");
    expect(row.handedOverAt).toBeInstanceOf(Date);
  });

  it("is idempotent and keeps the first confirmation time", async () => {
    const m = await matched();
    await confirmHandoff(m.donor.id, m.matchId);
    const first = (await matchRow(m.matchId)).donorConfirmedAt;
    await new Promise((r) => setTimeout(r, 15));
    await confirmHandoff(m.donor.id, m.matchId);
    expect((await matchRow(m.matchId)).donorConfirmedAt).toEqual(first);
    await confirmHandoff(m.req.id, m.matchId);
    expect(await confirmHandoff(m.req.id, m.matchId)).toEqual({ handedOver: true }); // after completion
  });

  it("strangers can't confirm, and a cancelled match can't be", async () => {
    const m = await matched();
    const stranger = await user("eve");
    await rejects(confirmHandoff(stranger.id, m.matchId), "FORBIDDEN");
    await rejects(confirmHandoff(m.donor.id, "missing"), "NOT_FOUND");
    await cancelMatch(m.donor.id, m.matchId);
    await rejects(confirmHandoff(m.req.id, m.matchId), "INVALID", /cancelled/);
  });

  it("counts toward both people's completed handoffs", async () => {
    const m = await handedOver();
    expect((await getReputation(m.donor.id)).handoffs).toBe(1);
    expect((await getReputation(m.req.id)).handoffs).toBe(1);
  });
});

describe("cancel record", () => {
  it("remembers who cancelled and when", async () => {
    const m = await matched();
    await cancelMatch(m.req.id, m.matchId);
    const row = await matchRow(m.matchId);
    expect(row.cancelledById).toBe(m.req.id);
    expect(row.cancelledAt).toBeInstanceOf(Date);
  });

  it("records the blocker when a block cancels the match", async () => {
    const m = await matched();
    await blockUser(m.donor.id, m.req.id);
    expect(await matchRow(m.matchId)).toMatchObject({ status: "CANCELLED", cancelledById: m.donor.id });
  });
});

describe("ratingVerdict", () => {
  const base = { status: "HANDED_OVER" as const, endedAt: new Date(), bothMessaged: false, blocked: false, alreadyRated: false };
  it("opens after a handoff, and after a cancel only if both spoke", () => {
    expect(ratingVerdict(base).ok).toBe(true);
    expect(ratingVerdict({ ...base, status: "ACTIVE" }).ok).toBe(false);
    expect(ratingVerdict({ ...base, status: "CANCELLED" }).ok).toBe(false);
    expect(ratingVerdict({ ...base, status: "CANCELLED", bothMessaged: true }).ok).toBe(true);
  });
  it("closes on block, on a repeat, and after the window", () => {
    expect(ratingVerdict({ ...base, blocked: true }).ok).toBe(false);
    expect(ratingVerdict({ ...base, alreadyRated: true }).ok).toBe(false);
    expect(ratingVerdict({ ...base, endedAt: daysAgo(RATING_WINDOW_DAYS - 1) }).ok).toBe(true);
    expect(ratingVerdict({ ...base, endedAt: daysAgo(RATING_WINDOW_DAYS + 1) }).ok).toBe(false);
  });
});

describe("rateMatch", () => {
  it("opens after the handoff, rates the other person, and feeds their reputation", async () => {
    const m = await matched();
    await rejects(rateMatch(m.donor.id, m.matchId, { score: 5 }), "INVALID", /handoff is confirmed/);

    await confirmHandoff(m.donor.id, m.matchId);
    await confirmHandoff(m.req.id, m.matchId);
    const { id } = await rateMatch(m.donor.id, m.matchId, { score: 4, comment: "  Lovely, on time.  " });
    expect(await prisma.rating.findUniqueOrThrow({ where: { id } })).toMatchObject({
      matchId: m.matchId, raterId: m.donor.id, rateeId: m.req.id, score: 4, comment: "Lovely, on time.",
    });
    await rateMatch(m.req.id, m.matchId, { score: 5 });

    expect(await getReputation(m.req.id)).toMatchObject({ rating: 4, ratingCount: 1 });
    expect(await getReputation(m.donor.id)).toMatchObject({ rating: 5, ratingCount: 1 });
  });

  it("validates the score and comment, and allows one rating each", async () => {
    const m = await handedOver();
    for (const score of [0, 6, 3.5, NaN]) await expect(rateMatch(m.donor.id, m.matchId, { score })).rejects.toThrow();
    await expect(rateMatch(m.donor.id, m.matchId, { score: 5, comment: "x".repeat(501) })).rejects.toThrow();
    expect(await prisma.rating.count()).toBe(0);

    await rateMatch(m.donor.id, m.matchId, { score: 5 });
    await rejects(rateMatch(m.donor.id, m.matchId, { score: 1 }), "INVALID", /already rated/);
    expect(await prisma.rating.count()).toBe(1);
  });

  it("is participants-only", async () => {
    const m = await handedOver();
    const stranger = await user("eve");
    await rejects(rateMatch(stranger.id, m.matchId, { score: 1 }), "FORBIDDEN");
    await rejects(rateMatch(m.donor.id, "missing", { score: 1 }), "NOT_FOUND");
  });

  it("after a cancel: only if both people exchanged messages", async () => {
    const silent = await matched();
    await cancelMatch(silent.donor.id, silent.matchId);
    await rejects(rateMatch(silent.req.id, silent.matchId, { score: 1 }), "INVALID", /both exchanged messages/);

    const oneSided = await matched();
    await sendMessage(oneSided.donor.id, oneSided.conversationId, { body: "hello?" });
    await cancelMatch(oneSided.req.id, oneSided.matchId);
    await rejects(rateMatch(oneSided.donor.id, oneSided.matchId, { score: 1 }), "INVALID", /both exchanged messages/);

    const talked = await matched();
    await sendMessage(talked.donor.id, talked.conversationId, { body: "hi" });
    await sendMessage(talked.req.id, talked.conversationId, { body: "hello" });
    await cancelMatch(talked.donor.id, talked.matchId);
    await rateMatch(talked.req.id, talked.matchId, { score: 2, comment: "Cancelled last minute" });
    expect(await prisma.rating.count()).toBe(1);
  });

  it("is closed after a block and after 30 days", async () => {
    const blocked = await handedOver();
    await prisma.block.create({ data: { blockerId: blocked.req.id, blockedId: blocked.donor.id } });
    await rejects(rateMatch(blocked.donor.id, blocked.matchId, { score: 1 }), "INVALID", /aren't available/);

    const old = await handedOver();
    await prisma.match.update({ where: { id: old.matchId }, data: { handedOverAt: daysAgo(RATING_WINDOW_DAYS + 1) } });
    await rejects(rateMatch(old.donor.id, old.matchId, { score: 5 }), "INVALID", /window/);
    await prisma.match.update({ where: { id: old.matchId }, data: { handedOverAt: daysAgo(RATING_WINDOW_DAYS - 1) } });
    await rateMatch(old.donor.id, old.matchId, { score: 5 });
  });
});

describe("thread rating state", () => {
  it("moves from closed, to open, to rated", async () => {
    const m = await matched();
    let t = await getThread(m.donor.id, m.conversationId);
    expect(t.rating).toMatchObject({ canRate: false, mine: null });
    expect(t.rating.reason).toMatch(/handoff is confirmed/);

    await confirmHandoff(m.donor.id, m.matchId);
    await confirmHandoff(m.req.id, m.matchId);
    t = await getThread(m.donor.id, m.conversationId);
    expect(t).toMatchObject({ matchStatus: "HANDED_OVER", rating: { canRate: true, reason: null, mine: null } });

    await rateMatch(m.donor.id, m.matchId, { score: 5, comment: "Great" });
    t = await getThread(m.donor.id, m.conversationId);
    expect(t.rating).toMatchObject({ canRate: false, reason: null, mine: { score: 5, comment: "Great" } });
    // the other person hasn't rated yet and still can
    expect((await getThread(m.req.id, m.conversationId)).rating).toMatchObject({ canRate: true, mine: null });
  });

  it("offers a rating after a cancel only when both spoke", async () => {
    const m = await matched();
    await sendMessage(m.donor.id, m.conversationId, { body: "hi" });
    await sendMessage(m.req.id, m.conversationId, { body: "hello" });
    await cancelMatch(m.req.id, m.matchId);
    expect((await getThread(m.donor.id, m.conversationId)).rating.canRate).toBe(true);

    const silent = await matched();
    await cancelMatch(silent.req.id, silent.matchId);
    expect((await getThread(silent.donor.id, silent.conversationId)).rating.canRate).toBe(false);
  });
});

describe("getMatchesToRate", () => {
  it("lists ended matches the user can still rate", async () => {
    const done = await handedOver();
    const cancelledTalked = await matched();
    await sendMessage(cancelledTalked.donor.id, cancelledTalked.conversationId, { body: "hi" });
    await sendMessage(cancelledTalked.req.id, cancelledTalked.conversationId, { body: "hey" });
    await cancelMatch(cancelledTalked.donor.id, cancelledTalked.matchId);

    const list = await getMatchesToRate(done.donor.id);
    expect(list.map((p) => [p.matchId, p.status, p.otherFirstName, p.listingTitle, p.conversationId])).toEqual([
      [done.matchId, "HANDED_OVER", "rae", "Dell", done.conversationId],
    ]);
    const forReq = await getMatchesToRate(cancelledTalked.req.id);
    expect(forReq.map((p) => [p.matchId, p.status, p.otherFirstName])).toEqual([[cancelledTalked.matchId, "CANCELLED", "dee"]]);
  });

  it("leaves out rated, silent-cancelled, blocked, stale and still-active matches", async () => {
    const donor = await user("dee");
    const make = async () => {
      const req = await user("rae");
      const [l, r] = [
        await prisma.listing.create({ data: { donorId: donor.id, deviceType: "LAPTOP", title: "Dell", description: "d", brand: "D", model: "1", condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future() } }),
        await prisma.request.create({ data: { requesterId: req.id, title: "Need", description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() } }),
      ];
      const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
      return { req, ...(await acceptOffer(req.id, o.id)) };
    };
    const done = async () => { const m = await make(); await confirmHandoff(donor.id, m.matchId); await confirmHandoff(m.req.id, m.matchId); return m; };

    const rated = await done();
    await rateMatch(donor.id, rated.matchId, { score: 5 });
    const silent = await make();
    await cancelMatch(donor.id, silent.matchId);
    const stale = await done();
    await prisma.match.update({ where: { id: stale.matchId }, data: { handedOverAt: daysAgo(40), updatedAt: daysAgo(40) } });
    const blockedOne = await done();
    await prisma.block.create({ data: { blockerId: blockedOne.req.id, blockedId: donor.id } });
    await make(); // still active
    const keep = await done();

    expect((await getMatchesToRate(donor.id)).map((p) => p.matchId)).toEqual([keep.matchId]);
  });
});

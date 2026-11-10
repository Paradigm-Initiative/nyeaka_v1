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
const sendEmail = vi.hoisted(() => vi.fn<(m: { to: string; subject: string; html: string }) => Promise<string>>());
vi.mock("@/lib/email", () => ({ sendEmail }));

import { prisma as _prisma } from "@/neon-db";
import { createOffer } from "@/lib/offers";
import { acceptOffer } from "@/lib/matches";
import { getThread, sendMessage } from "@/lib/messages";
import { createListing } from "@/lib/listings";
import { createRequest } from "@/lib/requests";
import {
  BLOCK_THRESHOLD, REPORT_THRESHOLD, blockUser, getBlockedUsers, isBlockedBetween,
  liftRestriction, reportUser, sharesMatch, unblockUser,
} from "@/lib/safety";
import { getListingDetail, getLiveListings, getLiveRequests, getRequestDetail } from "@/lib/queries";
import type { CreateListingInput, CreateRequestInput } from "@/validations/post-validation";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);
const ADMIN = "admin@nyeaka.test";

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, ...extra } });
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

/** A donor and a requester with an accepted match (so they share a chat). */
async function matchBetween(donorId: string, requesterId: string) {
  const [l, r] = [await listing(donorId, `Dev ${++n}`), await request(requesterId, `Req ${n}`)];
  const o = await createOffer(donorId, { listingId: l.id, requestId: r.id });
  const res = await acceptOffer(requesterId, o.id);
  return { l, r, o, ...res };
}
const sent = () => sendEmail.mock.calls.map((c) => c[0]);

async function rejects(p: Promise<unknown>, code: string, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toMatch(msg);
}
const isRestricted = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).restrictedAt !== null;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Report","Block","Message","Offer","Match","Listing","Request","user" CASCADE');
  sendEmail.mockReset();
  sendEmail.mockResolvedValue("email-id");
  process.env.ADMIN_EMAIL = ADMIN;
});
afterAll(() => testDb.stop());

describe("reportUser", () => {
  it("records who the report is about and emails the admin with escaped details", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    await matchBetween(donor.id, req.id);

    const { id } = await reportUser(req.id, {
      targetType: "USER", targetId: donor.id, reason: "SCAM", details: `<script>alert("x")</script> asked for money`,
    });

    const row = await prisma.report.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ reporterId: req.id, reportedUserId: donor.id, targetType: "USER", targetUserId: donor.id, reason: "SCAM", status: "OPEN" });
    expect(sent()).toHaveLength(1);
    const mail = sent()[0];
    expect(mail.to).toBe(ADMIN);
    expect(mail.subject).toContain("Scam or fraud");
    expect(mail.html).toContain(donor.email);
    expect(mail.html).toContain(req.email);
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("1 report from different people");
  });

  it("a listing report counts against its owner and a request report against its requester", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const { l, r } = await matchBetween(donor.id, req.id);

    const a = await reportUser(req.id, { targetType: "LISTING", targetId: l.id, reason: "MISREPRESENTED_DEVICE" });
    expect(await prisma.report.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ reportedUserId: donor.id, targetListingId: l.id });
    const b = await reportUser(donor.id, { targetType: "REQUEST", targetId: r.id, reason: "HARASSMENT" });
    expect(await prisma.report.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ reportedUserId: req.id, targetRequestId: r.id });
  });

  it("only works between people who share a chat", async () => {
    const [donor, req, stranger] = [await user("dee"), await user("rae"), await user("eve")];
    const { l } = await matchBetween(donor.id, req.id);
    await rejects(reportUser(stranger.id, { targetType: "USER", targetId: donor.id, reason: "SPAM" }), "FORBIDDEN", /matched with/);
    await rejects(reportUser(stranger.id, { targetType: "LISTING", targetId: l.id, reason: "SPAM" }), "FORBIDDEN");
    expect(await prisma.report.count()).toBe(0);
    expect(sent()).toHaveLength(0);
  });

  it("rejects self-reports, unknown targets and bad input", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    await matchBetween(donor.id, req.id);
    await rejects(reportUser(donor.id, { targetType: "USER", targetId: donor.id, reason: "SPAM" }), "INVALID", /yourself/);
    await rejects(reportUser(req.id, { targetType: "LISTING", targetId: "nope", reason: "SPAM" }), "NOT_FOUND");
    await rejects(reportUser(req.id, { targetType: "REQUEST", targetId: "nope", reason: "SPAM" }), "NOT_FOUND");
    await expect(reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "NOPE" as never })).rejects.toThrow();
    await expect(reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "SPAM", details: "x".repeat(1001) })).rejects.toThrow();
  });

  it("allows one open report per person, but another once it has been dismissed", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    await matchBetween(donor.id, req.id);
    const first = await reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "SCAM" });
    await rejects(reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "SPAM" }), "INVALID", /already reported/);

    await prisma.report.update({ where: { id: first.id }, data: { status: "DISMISSED" } });
    await reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "SPAM" });
    expect(await prisma.report.count()).toBe(2);
  });

  it("the database also blocks a duplicate open report", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const base = { reporterId: req.id, reportedUserId: donor.id, targetType: "USER" as const, targetUserId: donor.id, reason: "SPAM" as const };
    await prisma.report.create({ data: base });
    await expect(prisma.report.create({ data: base })).rejects.toMatchObject({ code: "P2002" });
  });

  it("is limited to 5 a day", async () => {
    const reporter = await user("rep");
    for (let i = 0; i < 5; i++) {
      const other = await user("o");
      await prisma.report.create({
        data: { reporterId: reporter.id, reportedUserId: other.id, targetType: "USER", targetUserId: other.id, reason: "SPAM" },
      });
    }
    const [donor] = [await user("dee")];
    await matchBetween(donor.id, reporter.id);
    await rejects(reportUser(reporter.id, { targetType: "USER", targetId: donor.id, reason: "SPAM" }), "RATE_LIMITED", /5 reports a day/);
  });

  it("is saved even if the admin email fails or no admin address is set", async () => {
    const [donor, req, req2] = [await user("dee"), await user("rae"), await user("rob")];
    await matchBetween(donor.id, req.id);
    await matchBetween(donor.id, req2.id);

    sendEmail.mockRejectedValue(new Error("mail provider down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await reportUser(req.id, { targetType: "USER", targetId: donor.id, reason: "SCAM" });
    quiet.mockRestore();

    delete process.env.ADMIN_EMAIL;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    sendEmail.mockClear();
    await reportUser(req2.id, { targetType: "USER", targetId: donor.id, reason: "SCAM" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ADMIN_EMAIL is not set"));
    warn.mockRestore();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.report.count()).toBe(2);
  });
});

describe("restriction", () => {
  async function reportedBy(target: string, count: number) {
    const reporters = [];
    for (let i = 0; i < count; i++) {
      const r = await user(`rep${i}`);
      await matchBetween(target, r.id);
      await reportUser(r.id, { targetType: "USER", targetId: target, reason: "SCAM" });
      reporters.push(r);
    }
    return reporters;
  }

  it(`restricts at ${REPORT_THRESHOLD} reports from different people, not before, and emails the admin and the user`, async () => {
    const target = await user("scammer");
    await reportedBy(target.id, REPORT_THRESHOLD - 1);
    expect(await isRestricted(target.id)).toBe(false);
    expect(sent().filter((m) => /restricted/i.test(m.subject))).toHaveLength(0);

    await reportedBy(target.id, 1);
    expect(await isRestricted(target.id)).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.restrictedReason).toBe("3 reports from different people");

    const restrictionMails = sent().filter((m) => /restricted/i.test(m.subject));
    expect(restrictionMails.map((m) => m.to).sort()).toEqual([ADMIN, target.email].sort());
    expect(restrictionMails.find((m) => m.to === target.email)?.html).toContain(ADMIN);
  });

  it("sends the restriction emails only once, however many more reports arrive", async () => {
    const target = await user("scammer");
    // The extra reporter needs a match with the target, which must exist before they are restricted.
    const late = await user("late");
    await matchBetween(target.id, late.id);

    await reportedBy(target.id, REPORT_THRESHOLD);
    const before = sent().filter((m) => /restricted/i.test(m.subject)).length;
    expect(before).toBe(2);
    await reportUser(late.id, { targetType: "USER", targetId: target.id, reason: "SCAM" });
    expect(sent().filter((m) => /restricted/i.test(m.subject)).length).toBe(before);
  });

  it("two live reports plus a dismissed one is not enough", async () => {
    const target = await user("fine");
    const [a, b, c] = [await user("a"), await user("b"), await user("c")];
    for (const u of [a, b, c]) await matchBetween(target.id, u.id);
    await prisma.report.create({ data: { reporterId: c.id, reportedUserId: target.id, targetType: "USER", targetUserId: target.id, reason: "SPAM", status: "DISMISSED" } });
    await reportUser(a.id, { targetType: "USER", targetId: target.id, reason: "SPAM" });
    await reportUser(b.id, { targetType: "USER", targetId: target.id, reason: "SPAM" });
    expect(await isRestricted(target.id)).toBe(false);
  });

  it(`restricts at ${BLOCK_THRESHOLD} blocks from different people, not at ${BLOCK_THRESHOLD - 1}`, async () => {
    const target = await user("pest");
    for (let i = 0; i < BLOCK_THRESHOLD - 1; i++) {
      const b = await user(`b${i}`);
      await matchBetween(target.id, b.id);
      await blockUser(b.id, target.id);
    }
    expect(await isRestricted(target.id)).toBe(false);
    const last = await user("last");
    await matchBetween(target.id, last.id);
    await blockUser(last.id, target.id);
    expect(await isRestricted(target.id)).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).restrictedReason).toBe("5 blocks from different people");
  });

  it("a restricted user cannot post or send offers, but can still chat and finish matches", async () => {
    const [restricted, other] = [await user("bad", { restrictedAt: new Date() }), await user("ok")];
    const l: CreateListingInput = { deviceType: "LAPTOP", brand: "HP", model: "1", condition: "GOOD", city: "Lagos", countryCode: "NG", photos: [] };
    const q: CreateRequestInput = { deviceType: "LAPTOP", title: "Need a laptop", description: "For my studies this term", city: "Lagos", countryCode: "NG", pledge: true };
    await rejects(createListing(restricted.id, l), "FORBIDDEN", /restricted/);
    await rejects(createRequest(restricted.id, q), "FORBIDDEN", /restricted/);
    const [theirListing, otherReq] = [await listing(restricted.id), await request(other.id)];
    await rejects(createOffer(restricted.id, { listingId: theirListing.id, requestId: otherReq.id }), "FORBIDDEN", /restricted/);

    // An existing match still works: lift, match, restrict, then chat.
    const pair = await matchBetween(other.id, (await user("peer")).id);
    await prisma.user.update({ where: { id: other.id }, data: { restrictedAt: new Date() } });
    await sendMessage(other.id, pair.conversationId, { body: "still able to talk" });
  });

  it("liftRestriction clears it", async () => {
    const u = await user("bad", { restrictedAt: new Date(), restrictedReason: "x" });
    await liftRestriction(u.id);
    expect(await isRestricted(u.id)).toBe(false);
    await createListing(u.id, { deviceType: "LAPTOP", brand: "HP", model: "1", condition: "GOOD", city: "Lagos", countryCode: "NG", photos: [] });
  });
});

describe("blockUser", () => {
  it("needs a match, rejects self-blocks, and is idempotent", async () => {
    const [a, b, stranger] = [await user("a"), await user("b"), await user("s")];
    await matchBetween(a.id, b.id);
    await rejects(blockUser(a.id, a.id), "INVALID");
    await rejects(blockUser(stranger.id, a.id), "FORBIDDEN", /matched with/);
    expect(await blockUser(b.id, a.id)).toEqual({ created: true });
    expect(await blockUser(b.id, a.id)).toEqual({ created: false });
    expect(await prisma.block.count()).toBe(1);
  });

  it("declines pending offers between them and cancels active matches, freeing the posts", async () => {
    const [donor, req, third] = [await user("dee"), await user("rae"), await user("tim")];
    const { l, r, matchId } = await matchBetween(donor.id, req.id);
    // a pending offer between the same two people, on other posts
    const [l2, r2] = [await listing(donor.id), await request(req.id)];
    const pending = await createOffer(donor.id, { listingId: l2.id, requestId: r2.id });
    // an unrelated pending offer must be left alone
    const l3 = await listing(third.id);
    const unrelated = await createOffer(third.id, { listingId: l3.id, requestId: r2.id });

    await blockUser(req.id, donor.id);

    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).status).toBe("CANCELLED");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("ACTIVE");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ACTIVE");
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("DECLINED");
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: unrelated.id } })).status).toBe("PENDING");
  });

  it("leaves a completed handoff alone", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const { matchId } = await matchBetween(donor.id, req.id);
    await prisma.match.update({ where: { id: matchId }, data: { status: "HANDED_OVER" } });
    await blockUser(req.id, donor.id);
    expect((await prisma.match.findUniqueOrThrow({ where: { id: matchId } })).status).toBe("HANDED_OVER");
  });

  it("stops offers, messages and accepts in both directions, without saying who blocked", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const pair = await matchBetween(donor.id, req.id);
    await prisma.match.update({ where: { id: pair.matchId }, data: { status: "HANDED_OVER" } }); // keep the chat around
    await blockUser(req.id, donor.id);

    const [l, r] = [await listing(donor.id), await request(req.id)];
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: r.id }), "INVALID", /can't send an offer/);
    await rejects(createOffer(req.id, { listingId: l.id, requestId: r.id }), "INVALID", /can't send an offer/);
    await rejects(sendMessage(donor.id, pair.conversationId, { body: "hi" }), "INVALID", /can't send messages/);
    await rejects(sendMessage(req.id, pair.conversationId, { body: "hi" }), "INVALID", /can't send messages/);

    // an offer that somehow exists can't be accepted either
    const offer = await prisma.offer.create({ data: { listingId: l.id, requestId: r.id, donorId: donor.id, initiatedById: donor.id } });
    await rejects(acceptOffer(req.id, offer.id), "INVALID", /no longer available/);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("PENDING");
  });

  it("shows the blocker 'you blocked them' but tells the blocked person nothing", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const pair = await matchBetween(donor.id, req.id);
    await prisma.match.update({ where: { id: pair.matchId }, data: { status: "HANDED_OVER" } });
    await blockUser(req.id, donor.id);

    const mine = await getThread(req.id, pair.conversationId);
    expect(mine).toMatchObject({ blockedByMe: true, canSend: false });
    const theirs = await getThread(donor.id, pair.conversationId);
    expect(theirs).toMatchObject({ blockedByMe: false, canSend: false });
  });

  it("unblock restores messaging and removes the entry", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const pair = await matchBetween(donor.id, req.id);
    await prisma.match.update({ where: { id: pair.matchId }, data: { status: "HANDED_OVER" } });
    await blockUser(req.id, donor.id);
    expect((await getBlockedUsers(req.id)).map((b) => [b.blockedId, b.blocked.firstName])).toEqual([[donor.id, "dee"]]);

    await unblockUser(req.id, donor.id);
    expect(await getBlockedUsers(req.id)).toEqual([]);
    expect(await isBlockedBetween(req.id, donor.id)).toBe(false);
    await sendMessage(donor.id, pair.conversationId, { body: "back in touch" });
  });

  it("is limited to 20 new blocks a day", async () => {
    const blocker = await user("blocker");
    for (let i = 0; i < 20; i++) {
      const o = await user("o");
      await prisma.block.create({ data: { blockerId: blocker.id, blockedId: o.id } });
    }
    const target = await user("target");
    await matchBetween(target.id, blocker.id);
    await rejects(blockUser(blocker.id, target.id), "RATE_LIMITED", /20 blocks a day/);
  });
});

describe("visibility", () => {
  const filters = { page: 1 } as Parameters<typeof getLiveListings>[0];

  it("hides posts from blocked people in both directions, and from everyone when the owner is restricted", async () => {
    const [viewer, blockedByViewer, blocksViewer, restricted, normal] = await Promise.all([
      user("viewer"), user("blockedByViewer"), user("blocksViewer"), user("restricted", { restrictedAt: new Date() }), user("normal"),
    ]);
    await prisma.block.create({ data: { blockerId: viewer.id, blockedId: blockedByViewer.id } });
    await prisma.block.create({ data: { blockerId: blocksViewer.id, blockedId: viewer.id } });
    for (const u of [blockedByViewer, blocksViewer, restricted, normal]) {
      await listing(u.id, `by ${u.firstName}`);
      await request(u.id, `by ${u.firstName}`);
    }

    const titles = async (v?: string) => ({
      l: (await getLiveListings(filters, v)).items.map((x) => x.title).sort(),
      r: (await getLiveRequests(filters, v)).items.map((x) => x.title).sort(),
    });
    expect(await titles(viewer.id)).toEqual({ l: ["by normal"], r: ["by normal"] });
    // A signed-out visitor only loses the restricted owner's posts.
    expect(await titles(undefined)).toEqual({
      l: ["by blockedByViewer", "by blocksViewer", "by normal"],
      r: ["by blockedByViewer", "by blocksViewer", "by normal"],
    });
  });

  it("detail pages 404 for blocked or restricted owners, but owners still see their own", async () => {
    const [viewer, other, restricted] = [await user("v"), await user("o"), await user("r", { restrictedAt: new Date() })];
    const [lo, ro, lr, rr] = [await listing(other.id), await request(other.id), await listing(restricted.id), await request(restricted.id)];

    expect(await getListingDetail(lo.id, viewer.id)).not.toBeNull();
    expect(await getRequestDetail(ro.id, viewer.id)).not.toBeNull();
    expect(await getListingDetail(lr.id, viewer.id)).toBeNull();
    expect(await getRequestDetail(rr.id, undefined)).toBeNull();
    expect(await getListingDetail(lr.id, restricted.id)).not.toBeNull(); // the owner

    await prisma.block.create({ data: { blockerId: viewer.id, blockedId: other.id } });
    expect(await getListingDetail(lo.id, viewer.id)).toBeNull();
    expect(await getRequestDetail(ro.id, viewer.id)).toBeNull();
    expect(await getListingDetail(lo.id, other.id)).not.toBeNull(); // the blocked person still sees their own post
    await prisma.block.deleteMany();
    await prisma.block.create({ data: { blockerId: other.id, blockedId: viewer.id } });
    expect(await getListingDetail(lo.id, viewer.id)).toBeNull(); // blocked the other way round
  });

  it("sharesMatch is symmetric and false for strangers", async () => {
    const [a, b, c] = [await user("a"), await user("b"), await user("c")];
    await matchBetween(a.id, b.id);
    expect(await sharesMatch(a.id, b.id)).toBe(true);
    expect(await sharesMatch(b.id, a.id)).toBe(true);
    expect(await sharesMatch(a.id, c.id)).toBe(false);
  });
});

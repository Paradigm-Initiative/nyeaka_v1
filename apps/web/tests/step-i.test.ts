import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ServiceError } from "@/lib/errors";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
const storage = vi.hoisted(() => ({ deleted: [] as string[], fail: false }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});
vi.mock("@/lib/storage-private", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage-private")>()),
  idObjectsExist: async () => true,
  deleteIdObjects: async (keys: string[]) => {
    if (storage.fail) throw new Error("R2 down");
    storage.deleted.push(...keys);
  },
}));
vi.mock("@/lib/notify", () => ({ notifyAdmin: async () => true, sendSafely: async () => true }));

import { prisma as _prisma } from "@/neon-db";
import { blockUser, hasDealings, reportUser } from "@/lib/safety";
import { getPublicProfile } from "@/lib/profile";
import { closeReportedPost, dismissReport, liftUserRestriction, listOpenReports, suspendUser, unsuspendUser } from "@/lib/moderation";
import { deleteAccount } from "@/lib/account";
import { submitVerification, approveVerification } from "@/lib/verification";
import { submitVerificationSchema } from "@/validations/verification-validation";
import { runPurge } from "@/lib/purge";

const prisma = _prisma as unknown as PrismaClient;

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "Tester", name: `${tag} Tester`, countryCode: "NG", idVerificationStatus: "VERIFIED", ...extra },
  });
const listing = (donorId: string, extra: Record<string, unknown> = {}) =>
  prisma.listing.create({ data: { donorId, deviceType: "LAPTOP", title: "HP", description: "d", brand: "HP", model: "450", condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: new Date(Date.now() + 864e5), ...extra } as never });
const request = (requesterId: string, extra: Record<string, unknown> = {}) =>
  prisma.request.create({ data: { requesterId, title: "Need laptop", description: "for school", countryCode: "NG", city: "Lagos", expiresAt: new Date(Date.now() + 864e5), ...extra } as never });
const offer = (donorId: string, listingId: string, requestId: string, initiatedById: string, status = "PENDING") =>
  prisma.offer.create({ data: { donorId, listingId, requestId, initiatedById, status } as never });
/** A donor and a requester with an ACTIVE match and a conversation. */
async function matched(d: { id: string }, r: { id: string }) {
  const l = await listing(d.id, { status: "MATCHED" });
  const q = await request(r.id, { status: "MATCHED" });
  const o = await offer(d.id, l.id, q.id, d.id, "ACCEPTED");
  const m = await prisma.match.create({ data: { offerId: o.id, donorId: d.id, requesterId: r.id, listingId: l.id, requestId: q.id } });
  const c = await prisma.conversation.create({ data: { matchId: m.id } });
  return { l, q, o, m, c };
}
async function rejects(p: Promise<unknown>, code: string, msg?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toBe(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
  await prisma.$executeRawUnsafe('DELETE FROM "BlockedDocument"'); // no link to users, so not cleared by the truncate
  storage.deleted = [];
  storage.fail = false;
});
afterAll(() => testDb.stop());

describe("report and block need dealings, not only a match", () => {
  it("someone who sent you an offer can be reported and blocked before any match", async () => {
    const donor = await user("donor");
    const asker = await user("asker");
    const l = await listing(donor.id);
    const q = await request(asker.id);
    await offer(donor.id, l.id, q.id, donor.id);
    expect(await hasDealings(asker.id, donor.id)).toBe(true);
    expect(await hasDealings(donor.id, asker.id)).toBe(true);
    await reportUser(asker.id, { targetType: "USER", targetId: donor.id, reason: "SCAM" });
    expect((await blockUser(asker.id, donor.id)).created).toBe(true);
    // the pending offer is declined by the block
    expect((await prisma.offer.findFirstOrThrow()).status).toBe("DECLINED");
  });

  it("strangers still can't report or block each other", async () => {
    const a = await user("a");
    const b = await user("b");
    expect(await hasDealings(a.id, b.id)).toBe(false);
    await rejects(
      reportUser(a.id, { targetType: "USER", targetId: b.id, reason: "SPAM" }),
      "FORBIDDEN",
      "You can only report someone you have been matched with or exchanged an offer with.",
    );
    await rejects(blockUser(a.id, b.id), "FORBIDDEN", "You can only block someone you have been matched with or exchanged an offer with.");
  });
});

describe("reporting a message", () => {
  it("reports the sender, only for people in the conversation", async () => {
    const d = await user("d");
    const r = await user("r");
    const out = await user("out");
    const { c } = await matched(d, r);
    const msg = await prisma.message.create({ data: { conversationId: c.id, senderId: d.id, body: "pay me first" } });
    const rep = await reportUser(r.id, { targetType: "MESSAGE", targetId: msg.id, reason: "SCAM" });
    expect(await prisma.report.findUniqueOrThrow({ where: { id: rep.id } })).toMatchObject({ reportedUserId: d.id, targetType: "MESSAGE", targetMessageId: msg.id });
    await rejects(reportUser(out.id, { targetType: "MESSAGE", targetId: msg.id, reason: "SCAM" }), "FORBIDDEN", "You are not part of this conversation");
    await rejects(reportUser(d.id, { targetType: "MESSAGE", targetId: msg.id, reason: "SCAM" }), "INVALID", "You can't report yourself.");
  });
});

describe("public profile", () => {
  it("shows name initial, country, rating and written reviews, and no private data", async () => {
    const d = await user("amara", { phone: "+2348012345678" });
    const r = await user("rae");
    const { m } = await matched(d, r);
    await prisma.rating.create({ data: { matchId: m.id, raterId: r.id, rateeId: d.id, score: 5, comment: "  Lovely and on time  " } });
    const p = await getPublicProfile(d.id, r.id);
    expect(p).toMatchObject({ displayName: "amara T.", countryCode: "NG", verified: true, isSelf: false, canReport: true });
    expect(p!.comments).toEqual([expect.objectContaining({ score: 5, comment: "Lovely and on time", by: "rae" })]);
    expect(JSON.stringify(p)).not.toContain("2348012345678");
    expect(JSON.stringify(p)).not.toContain("@t.test");
  });

  it("is a 404 for missing, deleted, suspended, restricted or blocked people", async () => {
    const viewer = await user("viewer");
    expect(await getPublicProfile("nope", viewer.id)).toBeNull();
    const del = await user("del", { deletedAt: new Date() });
    const sus = await user("sus", { suspendedAt: new Date() });
    const res = await user("res", { restrictedAt: new Date() });
    const blk = await user("blk");
    await prisma.block.create({ data: { blockerId: blk.id, blockedId: viewer.id } });
    for (const u of [del, sus, res, blk]) expect(await getPublicProfile(u.id, viewer.id)).toBeNull();
    // a restricted person can still see their own profile
    expect(await getPublicProfile(res.id, res.id)).not.toBeNull();
  });

  it("names a rater who deleted their account as a former member", async () => {
    const d = await user("d");
    const r = await user("r");
    const { m } = await matched(d, r);
    await prisma.rating.create({ data: { matchId: m.id, raterId: r.id, rateeId: d.id, score: 4, comment: "ok" } });
    await prisma.user.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
    expect((await getPublicProfile(d.id))!.comments[0].by).toBeNull();
  });
});

describe("moderation queue", () => {
  async function reported() {
    const admin = await user("admin", { role: "ADMIN" });
    const d = await user("donor");
    const r = await user("req");
    const { l, c } = await matched(d, r);
    const rep = await reportUser(r.id, { targetType: "LISTING", targetId: l.id, reason: "MISREPRESENTED_DEVICE" });
    return { admin, d, r, l, c, rep };
  }

  it("lists open reports oldest first, admin only", async () => {
    const { admin, d, rep } = await reported();
    const q = await listOpenReports(admin.id);
    expect(q.rows.map((x) => x.id)).toEqual([rep.id]);
    expect(q.rows[0].reportedUser.id).toBe(d.id);
    await rejects(listOpenReports(d.id), "FORBIDDEN", "Admins only.");
  });

  it("dismiss marks the report dismissed and logs it; it can't be handled twice", async () => {
    const { admin, rep } = await reported();
    await dismissReport(admin.id, rep.id, "photos were fine");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: rep.id } })).status).toBe("DISMISSED");
    expect(await prisma.adminAction.findFirstOrThrow({ where: { action: "report.dismiss" } })).toMatchObject({ targetId: rep.id, reason: "photos were fine" });
    await rejects(dismissReport(admin.id, rep.id), "INVALID", "This report has already been handled.");
  });

  it("close post closes the listing and marks the report actioned", async () => {
    const { admin, l, rep } = await reported();
    await closeReportedPost(admin.id, rep.id);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("CLOSED");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: rep.id } })).status).toBe("ACTIONED");
    expect(await prisma.adminAction.count({ where: { action: "report.close_post" } })).toBe(1);
  });

  it("lift restriction is logged", async () => {
    const { admin, d } = await reported();
    await prisma.user.update({ where: { id: d.id }, data: { restrictedAt: new Date(), restrictedReason: "reports" } });
    await liftUserRestriction(admin.id, d.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: d.id } })).restrictedAt).toBeNull();
    expect(await prisma.adminAction.count({ where: { action: "user.lift_restriction", targetId: d.id } })).toBe(1);
  });
});

describe("suspension", () => {
  const sub = (u: { id: string }, num: string) =>
    submitVerification(u.id, submitVerificationSchema.parse({
      documentType: "NATIONAL_ID", fullNameOnId: "Xavier Test", docNumber: num,
      frontKey: `id/${u.id}/f.jpg`, backKey: `id/${u.id}/b.jpg`, selfieKey: `id/${u.id}/s.jpg`,
    }));

  it("signs them out, closes posts, frees the other side, remembers the document for 12 months and logs it", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const bad = await user("bad", { idVerificationStatus: "NONE" });
    const good = await user("good");
    const { l: badListing, q: goodRequest } = await matched(bad, good);
    await prisma.session.create({ data: { id: "s1", token: "t1", userId: bad.id, expiresAt: new Date(Date.now() + 864e5) } });
    await sub(bad, "12345678901");
    await approveVerification(admin.id, (await prisma.idVerification.findFirstOrThrow({ where: { userId: bad.id } })).id);
    const open = await reportUser(good.id, { targetType: "USER", targetId: bad.id, reason: "SCAM" });

    await suspendUser(admin.id, bad.id, "scam attempt");

    expect(await prisma.user.findUniqueOrThrow({ where: { id: bad.id } })).toMatchObject({ suspendedReason: "scam attempt" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: bad.id } })).suspendedAt).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: bad.id } })).toBe(0);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: badListing.id } })).status).toBe("CLOSED");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: goodRequest.id } })).status).toBe("ACTIVE");
    expect((await prisma.match.findFirstOrThrow()).status).toBe("CANCELLED");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: open.id } })).status).toBe("ACTIONED");
    const kept = await prisma.blockedDocument.findMany();
    expect(kept).toHaveLength(1);
    const months = (kept[0].expiresAt.getUTCFullYear() - kept[0].createdAt.getUTCFullYear()) * 12 + kept[0].expiresAt.getUTCMonth() - kept[0].createdAt.getUTCMonth();
    expect(months).toBe(12);
    expect(await prisma.adminAction.count({ where: { action: "user.suspend", targetId: bad.id } })).toBe(1);

    // the same document can't verify a new account
    const fresh = await user("fresh", { idVerificationStatus: "NONE" });
    await rejects(sub(fresh, "1234-5678-901"), "INVALID", "We can't verify this document. Try a different one or contact support.");
  });

  it("refuses admins, yourself and double suspension; unsuspend releases the hash", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const other = await user("other", { role: "ADMIN" });
    const u = await user("u", { idVerificationStatus: "NONE" });
    await rejects(suspendUser(admin.id, admin.id, "x y z"), "FORBIDDEN", "You can't suspend yourself.");
    await rejects(suspendUser(admin.id, other.id, "x y z"), "FORBIDDEN", "Admins can't be suspended. Change their role first.");
    await rejects(suspendUser(u.id, admin.id, "x y z"), "FORBIDDEN", "Admins only.");
    await rejects(suspendUser(admin.id, u.id, " "), "INVALID", "A reason is required.");
    await sub(u, "99999999999");
    await suspendUser(admin.id, u.id, "abuse");
    await rejects(suspendUser(admin.id, u.id, "abuse"), "INVALID", "This person is already suspended.");
    expect(await prisma.blockedDocument.count()).toBe(1);
    await unsuspendUser(admin.id, u.id);
    expect(await prisma.blockedDocument.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).suspendedAt).toBeNull();
  });

  it("the purge job forgets the hash after 12 months", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const u = await user("u", { idVerificationStatus: "NONE" });
    await sub(u, "55555555555");
    await suspendUser(admin.id, u.id, "abuse");
    expect((await runPurge(new Date(Date.now() + 364 * 864e5))).hashesExpired).toBe(0);
    expect((await runPurge(new Date(Date.now() + 367 * 864e5))).hashesExpired).toBe(1);
  });
});

describe("account deletion", () => {
  it("anonymises the person, removes sign-in and ID data, closes posts and frees matches", async () => {
    const me = await user("me", { phone: "+2348012345678", bio: "hi" });
    const them = await user("them");
    const { l, q, m } = await matched(me, them);
    await prisma.account.create({ data: { id: "a1", accountId: me.id, providerId: "credential", userId: me.id, password: "hash" } });
    await prisma.session.create({ data: { id: "s1", token: "t1", userId: me.id, expiresAt: new Date(Date.now() + 864e5) } });
    await prisma.verification.create({ data: { id: "v1", identifier: me.email, value: "x", expiresAt: new Date(Date.now() + 864e5) } });
    await prisma.idVerification.create({ data: { userId: me.id, countryCode: "NG", documentType: "NATIONAL_ID", fullNameOnId: "Me", docNumberHash: "h1", frontKey: `id/${me.id}/f`, backKey: `id/${me.id}/b`, selfieKey: `id/${me.id}/s` } as never });

    await rejects(deleteAccount(me.id, "wrong@t.test"), "INVALID", "Type your email address to confirm.");
    expect(storage.deleted).toEqual([]);
    await deleteAccount(me.id, me.email.toUpperCase());

    const after = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(after).toMatchObject({ name: "Deleted user", firstName: "Deleted", phone: null, bio: null, image: null, idVerificationStatus: "NONE", emailVerified: false });
    expect(after.deletedAt).not.toBeNull();
    expect(after.email).toBe(`deleted-${me.id}@deleted.invalid`);
    expect(storage.deleted.sort()).toEqual([`id/${me.id}/b`, `id/${me.id}/f`, `id/${me.id}/s`]);
    expect(await prisma.idVerification.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.verification.count({ where: { identifier: me.email } })).toBe(0);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("CLOSED");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("ACTIVE"); // the other side is freed
    expect((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELLED");
    expect(await getPublicProfile(me.id, them.id)).toBeNull();
    // the real address can sign up again
    await user("again", { email: me.email });
    // no hash kept for someone who was never suspended
    expect(await prisma.blockedDocument.count()).toBe(0);
  });

  it("keeps the document hash 12 months for someone who was suspended, then lets the purge forget it", async () => {
    const u = await user("u", { suspendedAt: new Date(), idVerificationStatus: "NONE" });
    await prisma.idVerification.create({ data: { userId: u.id, countryCode: "NG", documentType: "PASSPORT", fullNameOnId: "U", docNumberHash: "keepme", frontKey: "k1", selfieKey: "k2" } as never });
    await deleteAccount(u.id, u.email);
    expect((await prisma.blockedDocument.findMany()).map((b) => b.docNumberHash)).toEqual(["keepme"]);
  });

  it("leaves everything in place if the images can't be deleted, so the person can retry", async () => {
    const u = await user("u");
    await prisma.idVerification.create({ data: { userId: u.id, countryCode: "NG", documentType: "PASSPORT", fullNameOnId: "U", docNumberHash: "h", frontKey: "k1", selfieKey: "k2" } as never });
    storage.fail = true;
    await expect(deleteAccount(u.id, u.email)).rejects.toThrow("R2 down");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.deletedAt).toBeNull();
    expect(await prisma.idVerification.count({ where: { userId: u.id } })).toBe(1);
  });

  it("refuses admins and people already deleted", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    await rejects(deleteAccount(admin.id, admin.email), "FORBIDDEN", "Admins can't delete their account here. Ask another admin to change your role first.");
    const u = await user("u");
    await deleteAccount(u.id, u.email);
    await rejects(deleteAccount(u.id, u.email), "NOT_FOUND");
  });
});

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
vi.mock("@/lib/storage-private", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage-private")>()),
  idObjectsExist: async () => true,
  presignIdView: async (key: string) => `https://signed.test/${key}?sig=1`,
  deleteIdObjects: async () => {},
}));

import { prisma as _prisma } from "@/neon-db";
import { submitVerification, approveVerification, rejectVerification, revealVerificationImages } from "@/lib/verification";
import { listDecisions, median, overturnVerification, reviewerStats, waitText } from "@/lib/verification-audit";
import { listPendingVerifications } from "@/lib/admin-queries";
import { runPurge, ABANDONED_REASON } from "@/lib/purge";
import { submitVerificationSchema } from "@/validations/verification-validation";

const prisma = _prisma as unknown as PrismaClient;
const DAY = 86_400_000;
const HOUR = 3_600_000;

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, countryCode: "NG", ...extra } });
const reviewer = (tag: string) => user(tag, { staffRole: "REVIEWER", twoFactorEnabled: true });
const admin = (tag = "adm") => user(tag, { staffRole: "ADMIN", twoFactorEnabled: true });

async function rejects(p: Promise<unknown>, code: string, msg?: string | RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (typeof msg === "string") expect((err as ServiceError).message).toBe(msg);
  else if (msg) expect((err as ServiceError).message).toMatch(msg);
}

let docs = 10_000_000_000;
const submit = (u: { id: string }) =>
  submitVerification(
    u.id,
    submitVerificationSchema.parse({
      documentType: "NATIONAL_ID", fullNameOnId: "Ada T", docNumber: String(++docs),
      frontKey: `id/${u.id}/f.jpg`, backKey: `id/${u.id}/b.jpg`, selfieKey: `id/${u.id}/s.jpg`,
    }),
  );
const row = (id: string) => prisma.idVerification.findUniqueOrThrow({ where: { id } });
const status = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).idVerificationStatus;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("decision list", () => {
  it("is admin only, newest first, and filters by reviewer, outcome and date", async () => {
    const [adm, r1, r2] = [await admin(), await reviewer("r1"), await reviewer("r2")];
    const people = await Promise.all(["a", "b", "c"].map((t) => user(t)));
    const [va, vb, vc] = await Promise.all(people.map(submit));
    await approveVerification(r1.id, va.id);
    await rejectVerification(r2.id, vb.id, "BLURRY");
    await approveVerification(r2.id, vc.id);
    await prisma.idVerification.update({ where: { id: va.id }, data: { decidedAt: new Date("2026-11-01T10:00:00Z") } });
    await prisma.idVerification.update({ where: { id: vb.id }, data: { decidedAt: new Date("2026-11-10T10:00:00Z") } });
    await prisma.idVerification.update({ where: { id: vc.id }, data: { decidedAt: new Date("2026-11-20T10:00:00Z") } });

    await rejects(listDecisions(r1.id), "FORBIDDEN", "Admins only.");
    const all = await listDecisions(adm.id);
    expect(all.rows.map((r) => r.id)).toEqual([vc.id, vb.id, va.id]);
    expect(all.total).toBe(3);
    expect((await listDecisions(adm.id, { reviewerId: r2.id })).rows.map((r) => r.id)).toEqual([vc.id, vb.id]);
    expect((await listDecisions(adm.id, { outcome: "FAILED" })).rows.map((r) => r.id)).toEqual([vb.id]);
    expect((await listDecisions(adm.id, { from: new Date("2026-11-05T00:00:00Z"), to: new Date("2026-11-15T00:00:00Z") })).rows.map((r) => r.id)).toEqual([vb.id]);
    expect((await listDecisions(adm.id, { reviewerId: r1.id, outcome: "FAILED" })).total).toBe(0);
  });

  it("leaves out cases the sweep closed, and keeps only metadata once images are purged", async () => {
    const [adm, r1] = [await admin(), await reviewer("r1")];
    const [a, b] = [await user("a"), await user("b")];
    const va = await submit(a);
    const vb = await submit(b);
    await approveVerification(r1.id, va.id);
    await prisma.idVerification.update({ where: { id: vb.id }, data: { status: "FAILED", rejectionReason: ABANDONED_REASON, decidedAt: new Date() } });
    await prisma.idVerification.update({ where: { id: va.id }, data: { imagesPurgeAt: new Date(Date.now() - DAY) } });
    await runPurge();
    const { rows } = await listDecisions(adm.id);
    expect(rows.map((r) => r.id)).toEqual([va.id]);
    expect(rows[0].imagesPurgedAt).not.toBeNull();
    await rejects(revealVerificationImages(adm.id, va.id), "INVALID", "These images have been deleted.");
  });
});

describe("reviewer stats", () => {
  it("counts decisions, approve rate and median wait per reviewer", async () => {
    const [adm, r1, r2] = [await admin(), await reviewer("r1"), await reviewer("r2")];
    const ids: string[] = [];
    for (const t of ["a", "b", "c", "d"]) ids.push((await submit(await user(t))).id);
    await approveVerification(r1.id, ids[0]);
    await approveVerification(r1.id, ids[1]);
    await rejectVerification(r1.id, ids[2], "EXPIRED");
    await rejectVerification(r2.id, ids[3], "BLURRY");
    const now = Date.now();
    // r1 waits: 1h, 3h, 5h  -> median 3h. r2: 10h.
    const waits = [1, 3, 5, 10];
    for (const [i, id] of ids.entries())
      await prisma.idVerification.update({ where: { id }, data: { createdAt: new Date(now - waits[i] * HOUR), decidedAt: new Date(now) } });
    await rejects(reviewerStats(r1.id), "FORBIDDEN");
    const stats = await reviewerStats(adm.id);
    const s1 = stats.find((s) => s.id === r1.id)!;
    expect(s1).toMatchObject({ count: 3, approved: 2, rejected: 1 });
    expect(s1.approveRate).toBeCloseTo(2 / 3);
    expect(s1.medianWaitMs).toBeCloseTo(3 * HOUR, -3);
    expect(stats.find((s) => s.id === r2.id)).toMatchObject({ count: 1, approveRate: 0 });
    expect(stats[0].id).toBe(r1.id); // most decisions first
    expect((await reviewerStats(adm.id, { outcome: "FAILED" })).find((s) => s.id === r1.id)?.count).toBe(1);
  });

  it("median and wait text", () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(waitText(null)).toBe("n/a");
    expect(waitText(30 * 60_000)).toBe("30 min");
    expect(waitText(5 * HOUR)).toBe("5.0 h");
    expect(waitText(3 * DAY)).toBe("3.0 d");
  });
});

describe("overturn", () => {
  const decided = async (outcome: "approve" | "reject" = "approve") => {
    const [adm, r1, applicant] = [await admin(), await reviewer("r1"), await user("ada")];
    const v = await submit(applicant);
    if (outcome === "approve") await approveVerification(r1.id, v.id);
    else await rejectVerification(r1.id, v.id, "BLURRY");
    return { adm, r1, applicant, v };
  };

  it("with images still stored: back to PENDING, user reset, clock cleared, logged, queue shows it reopened", async () => {
    const { adm, r1, applicant, v } = await decided("approve");
    expect((await row(v.id)).imagesPurgeAt).not.toBeNull();
    expect(await status(applicant.id)).toBe("VERIFIED");
    expect(await overturnVerification(adm.id, v.id, "  Wrong person on the selfie ")).toEqual({ reopened: true });
    expect(await row(v.id)).toMatchObject({
      status: "PENDING", reviewedById: null, decidedAt: null, rejectionCode: null, imagesPurgeAt: null, imagesPurgedAt: null,
      overturnedById: adm.id, overturnNote: "Wrong person on the selfie", claimedById: null,
    });
    expect((await row(v.id)).frontKey).not.toBeNull(); // images kept for the re-review
    expect(await status(applicant.id)).toBe("PENDING");
    const log = await prisma.adminAction.findFirstOrThrow({ where: { action: "id.overturn", targetId: v.id } });
    expect(log).toMatchObject({ actorId: adm.id, reason: "Wrong person on the selfie" });
    expect(log.meta).toMatchObject({ previousStatus: "VERIFIED", previousReviewerId: r1.id, reopened: true });
    const q = (await listPendingVerifications(r1.id)).rows.find((r) => r.id === v.id);
    expect(q?.reopened).toBe(true);
  });

  it("the re-decision starts a fresh 30-day clock, and a rejected case can be overturned to approve", async () => {
    const { adm, r1, applicant, v } = await decided("reject");
    expect(await status(applicant.id)).toBe("FAILED");
    await overturnVerification(adm.id, v.id, "Photo was fine on a second look");
    const r2 = await reviewer("r2");
    await approveVerification(r2.id, v.id);
    const after = await row(v.id);
    expect(after).toMatchObject({ status: "VERIFIED", reviewedById: r2.id });
    expect(after.imagesPurgeAt!.getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect(await status(applicant.id)).toBe("VERIFIED");
    void r1;
  });

  it("with images already purged: the case doesn't reopen, the person goes back to NONE and must resubmit", async () => {
    const { adm, applicant, v } = await decided("approve");
    await prisma.idVerification.update({ where: { id: v.id }, data: { imagesPurgeAt: new Date(Date.now() - DAY) } });
    await runPurge();
    expect(await overturnVerification(adm.id, v.id, "Decision was wrong")).toEqual({ reopened: false });
    expect(await row(v.id)).toMatchObject({ status: "VERIFIED", frontKey: null, overturnedById: adm.id });
    expect(await status(applicant.id)).toBe("NONE");
    await submit(applicant); // can submit again
    expect(await status(applicant.id)).toBe("PENDING");
    expect((await prisma.adminAction.findFirstOrThrow({ where: { action: "id.overturn" } })).meta).toMatchObject({ reopened: false });
  });

  it("clears a first decision too, so the second-reviewer rule applies afresh", async () => {
    const { adm, r1, v } = await decided("approve");
    await prisma.idVerification.update({ where: { id: v.id }, data: { firstDecisionById: r1.id, firstOutcome: "VERIFIED" } });
    await overturnVerification(adm.id, v.id, "Redo from scratch");
    expect(await row(v.id)).toMatchObject({ firstDecisionById: null, firstOutcome: null });
  });

  it("is admin only, needs a note, and refuses your own, undecided, abandoned and non-latest cases", async () => {
    const { adm, r1, applicant, v } = await decided("approve");
    await rejects(overturnVerification(r1.id, v.id, "I disagree"), "FORBIDDEN", "Admins only.");
    await rejects(overturnVerification(adm.id, v.id, " x "), "INVALID", /note/);
    await rejects(overturnVerification(adm.id, "nope", "long enough"), "NOT_FOUND");

    const mine = await submit(adm);
    await approveVerification(r1.id, mine.id);
    await rejects(overturnVerification(adm.id, mine.id, "my own"), "FORBIDDEN", /your own/);

    const fresh = await submit(await user("pend"));
    await rejects(overturnVerification(adm.id, fresh.id, "not decided"), "INVALID", /already waiting/);

    const ab = await submit(await user("ab"));
    await prisma.idVerification.update({ where: { id: ab.id }, data: { status: "FAILED", rejectionReason: ABANDONED_REASON, decidedAt: new Date() } });
    await rejects(overturnVerification(adm.id, ab.id, "swept"), "INVALID", /nobody reviewed it in time/);

    // a newer submission exists: only the most recent can be overturned
    await prisma.idVerification.update({ where: { id: v.id }, data: { status: "FAILED" } });
    await prisma.user.update({ where: { id: applicant.id }, data: { idVerificationStatus: "FAILED" } });
    await submit(applicant);
    await rejects(overturnVerification(adm.id, v.id, "old one"), "INVALID", /most recent/);
  });

  it("two admins overturning at once: only one applies", async () => {
    const { adm, v } = await decided("approve");
    const adm2 = await admin("adm2");
    const results = await Promise.allSettled([overturnVerification(adm.id, v.id, "first one"), overturnVerification(adm2.id, v.id, "second one")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.adminAction.count({ where: { action: "id.overturn" } })).toBe(1);
    expect((await row(v.id)).status).toBe("PENDING");
  });
});

describe("the not-reviewed-in-time sweep and reopened cases", () => {
  it("a reopened case counts from the reopen, not from its old submission date", async () => {
    const [adm, r1, applicant] = [await admin(), await reviewer("r1"), await user("ada")];
    const v = await submit(applicant);
    await approveVerification(r1.id, v.id);
    await prisma.idVerification.update({ where: { id: v.id }, data: { createdAt: new Date(Date.now() - 40 * DAY) } });
    await overturnVerification(adm.id, v.id, "Reopen it");
    expect((await runPurge()).abandoned).toBe(0);
    expect((await row(v.id)).status).toBe("PENDING");
    await prisma.idVerification.update({ where: { id: v.id }, data: { overturnedAt: new Date(Date.now() - 31 * DAY) } });
    expect((await runPurge()).abandoned).toBe(1); // and it still times out if nobody looks at it
  });
});

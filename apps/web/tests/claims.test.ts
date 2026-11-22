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
}));

import { prisma as _prisma } from "@/neon-db";
import { submitVerification, approveVerification, rejectVerification, revealVerificationImages } from "@/lib/verification";
import { CLAIM_TTL_MS, claimVerification, releaseVerification, SECOND_REVIEWER } from "@/lib/verification-claims";
import { setStaffRole } from "@/lib/staff";
import { getVerificationForReview, listPendingVerifications } from "@/lib/admin-queries";
import { submitVerificationSchema } from "@/validations/verification-validation";

const prisma = _prisma as unknown as PrismaClient;

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, countryCode: "NG", ...extra } });
const reviewer = (tag: string) => user(tag, { staffRole: "REVIEWER", twoFactorEnabled: true });

async function rejects(p: Promise<unknown>, code: string, msg?: string | RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (typeof msg === "string") expect((err as ServiceError).message).toBe(msg);
  else if (msg) expect((err as ServiceError).message).toMatch(msg);
}

const submit = (u: { id: string }, docNumber: string) =>
  submitVerification(
    u.id,
    submitVerificationSchema.parse({
      documentType: "NATIONAL_ID", fullNameOnId: "Ada T", docNumber,
      frontKey: `id/${u.id}/f.jpg`, backKey: `id/${u.id}/b.jpg`, selfieKey: `id/${u.id}/s.jpg`,
    }),
  );

const row = (id: string) => prisma.idVerification.findUniqueOrThrow({ where: { id } });
const lapse = (id: string, ms = CLAIM_TTL_MS + 1000) =>
  prisma.idVerification.update({ where: { id }, data: { claimedAt: new Date(Date.now() - ms) } });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("claiming", () => {
  it("opening a case claims it for 15 minutes, and the holder can claim again to renew", async () => {
    const [r1, applicant] = [await reviewer("r1"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    const out = await claimVerification(r1.id, v.id);
    expect(out.expiresAt.getTime() - Date.now()).toBeGreaterThan(CLAIM_TTL_MS - 5000);
    expect((await row(v.id)).claimedById).toBe(r1.id);
    const before = (await row(v.id)).claimedAt!;
    await new Promise((r) => setTimeout(r, 15));
    await claimVerification(r1.id, v.id);
    expect((await row(v.id)).claimedAt!.getTime()).toBeGreaterThan(before.getTime());
  });

  it("a second reviewer is refused while the claim is live, and everything is locked to them", async () => {
    const [r1, r2, applicant] = [await reviewer("r1"), await reviewer("r2"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await claimVerification(r1.id, v.id);
    await rejects(claimVerification(r2.id, v.id), "INVALID", /r1 T is reviewing this case/);
    await rejects(approveVerification(r2.id, v.id), "INVALID", /r1 T is reviewing/);
    await rejects(revealVerificationImages(r2.id, v.id), "INVALID", /r1 T is reviewing/);
    expect((await row(v.id)).status).toBe("PENDING");
    expect((await row(v.id)).claimedById).toBe(r1.id);
  });

  it("two reviewers opening at the same moment: exactly one gets it", async () => {
    const [r1, r2, r3, applicant] = [await reviewer("r1"), await reviewer("r2"), await reviewer("r3"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    const results = await Promise.allSettled([r1, r2, r3].map((r) => claimVerification(r.id, v.id)));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const winner = (await row(v.id)).claimedById;
    expect([r1.id, r2.id, r3.id]).toContain(winner);
  });

  it("a claim lapses after 15 minutes idle, with no job: someone else can take it and decide", async () => {
    const [r1, r2, applicant] = [await reviewer("r1"), await reviewer("r2"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await claimVerification(r1.id, v.id);
    await lapse(v.id, CLAIM_TTL_MS - 60_000); // still live
    await rejects(claimVerification(r2.id, v.id), "INVALID");
    await lapse(v.id); // now lapsed
    await claimVerification(r2.id, v.id);
    expect((await row(v.id)).claimedById).toBe(r2.id);
    await lapse(v.id);
    await approveVerification(r1.id, v.id); // r1 comes back; r2's claim has lapsed too
    expect(await row(v.id)).toMatchObject({ status: "VERIFIED", reviewedById: r1.id, claimedById: null, claimedAt: null });
  });

  it("deciding doesn't need a prior claim, and clears it", async () => {
    const [r1, applicant] = [await reviewer("r1"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await rejectVerification(r1.id, v.id, "BLURRY");
    expect(await row(v.id)).toMatchObject({ status: "FAILED", claimedById: null });
  });

  it("viewing the images takes the claim and renews it", async () => {
    const [r1, applicant] = [await reviewer("r1"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await revealVerificationImages(r1.id, v.id);
    expect((await row(v.id)).claimedById).toBe(r1.id);
  });

  it("release gives it back, only the holder can release, and you can't claim your own case", async () => {
    const [r1, r2, applicant] = [await reviewer("r1"), await reviewer("r2"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await claimVerification(r1.id, v.id);
    await releaseVerification(r2.id, v.id); // not theirs: nothing happens
    expect((await row(v.id)).claimedById).toBe(r1.id);
    await releaseVerification(r1.id, v.id);
    expect(await row(v.id)).toMatchObject({ claimedById: null, claimedAt: null });
    await claimVerification(r2.id, v.id);

    const mine = await submit(r1, "22222222222");
    await rejects(claimVerification(r1.id, mine.id), "FORBIDDEN", "You can't review your own verification.");
  });

  it("removing a reviewer frees the cases they hold straight away", async () => {
    const [admin, r1, r2, applicant] = [await user("adm", { staffRole: "ADMIN", twoFactorEnabled: true }), await reviewer("r1"), await reviewer("r2"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await claimVerification(r1.id, v.id);
    await setStaffRole(admin.id, r1.id, null);
    expect(await row(v.id)).toMatchObject({ claimedById: null, claimedAt: null });
    await claimVerification(r2.id, v.id); // free for someone else without waiting 15 minutes
  });

  it("a decided case can't be claimed, and non-staff can't claim", async () => {
    const [r1, applicant] = [await reviewer("r1"), await user("ada")];
    const v = await submit(applicant, "11111111111");
    await approveVerification(r1.id, v.id);
    await rejects(claimVerification(r1.id, v.id), "INVALID", "This submission has already been decided.");
    await rejects(claimVerification(applicant.id, v.id), "FORBIDDEN", "Staff only.");
  });
});

describe("the queue", () => {
  it("is oldest first, shows locks, and marks your own claim", async () => {
    const [r1, r2] = [await reviewer("r1"), await reviewer("r2")];
    const [a, b, c] = [await user("a"), await user("b"), await user("c")];
    const va = await submit(a, "11111111111");
    const vb = await submit(b, "22222222222");
    const vc = await submit(c, "33333333333");
    await prisma.idVerification.update({ where: { id: va.id }, data: { createdAt: new Date(Date.now() - 3e6) } });
    await prisma.idVerification.update({ where: { id: vb.id }, data: { createdAt: new Date(Date.now() - 2e6) } });
    await claimVerification(r1.id, va.id);
    await claimVerification(r2.id, vb.id);
    const { rows } = await listPendingVerifications(r1.id);
    expect(rows.map((r) => r.id)).toEqual([va.id, vb.id, vc.id]);
    expect(rows[0]).toMatchObject({ claimedByMe: true, lockedBy: null });
    expect(rows[1]).toMatchObject({ claimedByMe: false, lockedBy: "r2 T" });
    expect(rows[2]).toMatchObject({ lockedBy: null });
    await lapse(vb.id);
    expect((await listPendingVerifications(r1.id)).rows[1].lockedBy).toBeNull(); // lapsed, free again
  });
});

describe("second reviewer for a matching document number", () => {
  const pair = async () => {
    const [a, b] = [await user("ada"), await user("bola")];
    const va = await submit(a, "99999999999");
    await submit(b, "9999-9999-999"); // same number, typed differently
    return { a, b, va };
  };

  it("the first decision is recorded but the case stays pending and the person isn't affected", async () => {
    const [r1, r2] = [await reviewer("r1"), await reviewer("r2")];
    const { a, va } = await pair();
    const d = await approveVerification(r1.id, va.id);
    expect(d.final).toBe(false);
    expect(await row(va.id)).toMatchObject({
      status: "PENDING", firstDecisionById: r1.id, firstOutcome: "VERIFIED", claimedById: null, reviewedById: null, decidedAt: null, imagesPurgeAt: null,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).idVerificationStatus).not.toBe("VERIFIED");
    expect(await prisma.adminAction.count({ where: { action: "id.first_decision", actorId: r1.id } })).toBe(1);
    expect(await prisma.adminAction.count({ where: { action: "id.approve" } })).toBe(0);

    const review = await getVerificationForReview(r2.id, va.id);
    expect(review).toMatchObject({ needsSecondReviewer: false, recused: false, firstOutcome: "VERIFIED" });
    expect(review.firstDecisionBy?.name).toBe("r1 T");
  });

  it("the first reviewer can't claim, view or finish it; a different reviewer finishes it", async () => {
    const [r1, r2] = [await reviewer("r1"), await reviewer("r2")];
    const { a, va } = await pair();
    await rejectVerification(r1.id, va.id, "NAME_MISMATCH");
    await rejects(claimVerification(r1.id, va.id), "FORBIDDEN", SECOND_REVIEWER);
    await rejects(approveVerification(r1.id, va.id), "FORBIDDEN", SECOND_REVIEWER);
    await rejects(revealVerificationImages(r1.id, va.id), "FORBIDDEN", SECOND_REVIEWER);
    expect((await listPendingVerifications(r1.id)).rows.find((r) => r.id === va.id)?.recused).toBe(true);

    const final = await approveVerification(r2.id, va.id); // the second reviewer may disagree
    expect(final.final).toBe(true);
    expect(await row(va.id)).toMatchObject({ status: "VERIFIED", reviewedById: r2.id, firstDecisionById: r1.id });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).idVerificationStatus).toBe("VERIFIED");
    const log = await prisma.adminAction.findFirstOrThrow({ where: { action: "id.approve", targetId: va.id } });
    expect(log.meta).toMatchObject({ firstReviewerId: r1.id, firstOutcome: "FAILED" });
  });

  it("the review data says a second reviewer is needed until the first decision exists", async () => {
    const r1 = await reviewer("r1");
    const { va } = await pair();
    expect(await getVerificationForReview(r1.id, va.id)).toMatchObject({ needsSecondReviewer: true, recused: false });
    await approveVerification(r1.id, va.id);
    expect(await getVerificationForReview(r1.id, va.id)).toMatchObject({ needsSecondReviewer: false, recused: true });
  });

  it("two reviewers deciding at once can never both be the first, nor can one reviewer finish their own first decision", async () => {
    const [r1, r2] = [await reviewer("r1"), await reviewer("r2")];
    const { va } = await pair();
    const results = await Promise.allSettled([approveVerification(r1.id, va.id), approveVerification(r2.id, va.id)]);
    const after = await row(va.id);
    expect([r1.id, r2.id]).toContain(after.firstDecisionById);
    if (after.status === "PENDING") {
      // a true tie: one first decision was recorded and the other reviewer was turned away
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    } else {
      // they ran one after the other: first decision, then a different reviewer's final one
      expect(after.reviewedById).not.toBe(after.firstDecisionById);
    }
  });

  it("a case with no matching number is decided by one reviewer, as before", async () => {
    const [r1, a] = [await reviewer("r1"), await user("ada")];
    const v = await submit(a, "12121212121");
    expect((await approveVerification(r1.id, v.id)).final).toBe(true);
    expect(await row(v.id)).toMatchObject({ status: "VERIFIED", firstDecisionById: null });
  });
});

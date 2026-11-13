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

const storage = vi.hoisted(() => ({ exist: true }));
vi.mock("@/lib/storage-private", async (orig) => ({
  ...(await orig<typeof import("@/lib/storage-private")>()),
  idObjectsExist: async () => storage.exist,
}));

import { prisma as _prisma } from "@/neon-db";
import {
  approveVerification,
  assertVerified,
  hashDocNumber,
  rejectVerification,
  submitVerification,
  NOT_VERIFIED,
} from "@/lib/verification";
import { createListing } from "@/lib/listings";
import { createRequest } from "@/lib/requests";
import { createOffer } from "@/lib/offers";
import { errorKey } from "@/lib/error-keys";
import { isOwnIdKey } from "@/lib/storage-private";
import { submitVerificationSchema } from "@/validations/verification-validation";

const prisma = _prisma as unknown as PrismaClient;

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, countryCode: "NG", ...extra },
  });

async function rejects(p: Promise<unknown>, code: string, msg?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toBe(msg);
}

const keys = (userId: string) => ({
  frontKey: `id/${userId}/front.jpg`,
  backKey: `id/${userId}/back.jpg`,
  selfieKey: `id/${userId}/selfie.jpg`,
});
const submission = (userId: string, extra: Record<string, unknown> = {}) =>
  submitVerificationSchema.parse({
    documentType: "NATIONAL_ID",
    fullNameOnId: "Ada Eze",
    docNumber: "12345678901",
    ...keys(userId),
    ...extra,
  });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
  storage.exist = true;
});
afterAll(() => testDb.stop());

describe("submitVerification", () => {
  it("creates a PENDING row with a hash, never the number, and moves the user to PENDING", async () => {
    const u = await user("ada");
    const { id } = await submitVerification(u.id, submission(u.id));
    const row = await prisma.idVerification.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "PENDING", countryCode: "NG", documentType: "NATIONAL_ID", fullNameOnId: "Ada Eze" });
    expect(row.docNumberHash).toBe(hashDocNumber("NG", "NATIONAL_ID", "12345678901"));
    expect(JSON.stringify(row)).not.toContain("12345678901");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("PENDING");
  });

  it("hashes the same document the same way however it is typed", () => {
    expect(hashDocNumber("NG", "PASSPORT", "a12-345 678")).toBe(hashDocNumber("NG", "PASSPORT", "A12345678"));
    expect(hashDocNumber("NG", "PASSPORT", "A1234567")).not.toBe(hashDocNumber("GH", "PASSPORT", "A1234567"));
  });

  it("refuses a second submission while one is pending", async () => {
    const u = await user("ada");
    await submitVerification(u.id, submission(u.id));
    await rejects(submitVerification(u.id, submission(u.id)), "INVALID", "Your verification is already being reviewed.");
    expect(await prisma.idVerification.count({ where: { userId: u.id } })).toBe(1);
  });

  it("the database allows only one PENDING row per user", async () => {
    const u = await user("ada");
    await submitVerification(u.id, submission(u.id));
    await expect(
      prisma.idVerification.create({
        data: { userId: u.id, countryCode: "NG", documentType: "PASSPORT", fullNameOnId: "x", frontKey: "k", selfieKey: "s" },
      }),
    ).rejects.toThrow();
  });

  it("refuses someone already verified", async () => {
    const u = await user("ada", { idVerificationStatus: "VERIFIED" });
    await rejects(submitVerification(u.id, submission(u.id)), "INVALID", "Your identity is already verified.");
  });

  it("checks the Nigerian NIN format only for a national ID", async () => {
    const u = await user("ada");
    await rejects(submitVerification(u.id, submission(u.id, { docNumber: "123" })), "INVALID", "Enter a valid ID number.");
    await rejects(submitVerification(u.id, submission(u.id, { docNumber: "1234567890A" })), "INVALID", "Enter a valid ID number.");
    // A passport number has no NIN rule.
    await submitVerification(u.id, submission(u.id, { documentType: "PASSPORT", docNumber: "A1234567", backKey: undefined }));
  });

  it("only accepts documents the user's country lists", async () => {
    const gh = await user("kofi", { countryCode: "GH" });
    await rejects(
      submitVerification(gh.id, submission(gh.id, { documentType: "VOTERS_CARD", docNumber: "ABC12345" })),
      "INVALID",
      "That document isn't accepted in your country.",
    );
  });

  it("needs a back photo unless it is a passport", async () => {
    const u = await user("ada");
    await rejects(submitVerification(u.id, submission(u.id, { backKey: undefined })), "INVALID", "Upload the required ID photos.");
  });

  it("only takes image keys under the user's own folder", async () => {
    const u = await user("ada");
    const other = await user("bo");
    await rejects(
      submitVerification(u.id, submission(u.id, { frontKey: `id/${other.id}/front.jpg` })),
      "INVALID",
      "Upload the required ID photos.",
    );
    expect(isOwnIdKey(u.id, `id/${u.id}/../${other.id}/x.jpg`)).toBe(false);
    expect(isOwnIdKey(u.id, `listings/${u.id}/x.jpg`)).toBe(false);
  });

  it("refuses keys whose files were never uploaded, and creates nothing", async () => {
    const u = await user("ada");
    storage.exist = false;
    await rejects(submitVerification(u.id, submission(u.id)), "INVALID", "Upload the required ID photos.");
    expect(await prisma.idVerification.count({ where: { userId: u.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("NONE");
  });

  it("refuses an expired ID", async () => {
    const u = await user("ada");
    await rejects(submitVerification(u.id, submission(u.id, { docExpiry: "2020-01-01" })), "INVALID", "The ID has expired. Use one that is still valid.");
  });
});

describe("approve and reject", () => {
  const setup = async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const u = await user("ada");
    const { id } = await submitVerification(u.id, submission(u.id));
    return { admin, u, id };
  };

  it("approve verifies the user, schedules the image purge in 30 days and logs it", async () => {
    const { admin, u, id } = await setup();
    await approveVerification(admin.id, id);
    const row = await prisma.idVerification.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "VERIFIED", reviewedById: admin.id });
    const days = (row.imagesPurgeAt!.getTime() - row.decidedAt!.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(30, 3);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("VERIFIED");
    const log = await prisma.adminAction.findFirstOrThrow({ where: { targetId: id } });
    expect(log).toMatchObject({ actorId: admin.id, action: "id.approve", targetType: "IdVerification" });
  });

  it("reject needs a reason, marks the user FAILED and lets them submit again", async () => {
    const { admin, u, id } = await setup();
    await rejects(rejectVerification(admin.id, id, "  "), "INVALID", "A rejection reason is required.");
    await rejectVerification(admin.id, id, "Photo is blurry");
    const row = await prisma.idVerification.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "FAILED", rejectionReason: "Photo is blurry" });
    expect(row.imagesPurgeAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("FAILED");
    await submitVerification(u.id, submission(u.id)); // a fresh PENDING row is allowed again
    expect(await prisma.idVerification.count({ where: { userId: u.id } })).toBe(2);
  });

  it("a submission can be decided only once", async () => {
    const { admin, id } = await setup();
    await approveVerification(admin.id, id);
    await rejects(rejectVerification(admin.id, id, "late"), "INVALID", "This submission has already been decided.");
    await rejects(approveVerification(admin.id, id), "INVALID", "This submission has already been decided.");
  });

  it("only admins can decide, and nobody can review their own", async () => {
    const { u, id } = await setup();
    await rejects(approveVerification(u.id, id), "FORBIDDEN", "Admins only.");
    const admin = await user("selfadmin", { role: "ADMIN" });
    const mine = await submitVerification(admin.id, submission(admin.id));
    await rejects(approveVerification(admin.id, mine.id), "FORBIDDEN", "You can't review your own verification.");
  });
});

describe("gating on VERIFIED", () => {
  const listingInput = { deviceType: "LAPTOP", brand: "HP", model: "450", condition: "GOOD", city: "Lagos", photos: [] } as const;
  const requestInput = { deviceType: "LAPTOP", title: "Need a laptop", description: "For school work and study", city: "Lagos", pledge: true } as const;

  it("assertVerified passes only for VERIFIED", async () => {
    for (const status of ["NONE", "PENDING", "FAILED"] as const) {
      const u = await user(status, { idVerificationStatus: status });
      await rejects(assertVerified(u.id), "FORBIDDEN", NOT_VERIFIED);
    }
    await assertVerified((await user("ok", { idVerificationStatus: "VERIFIED" })).id);
  });

  it("blocks listings, requests and offers until verified", async () => {
    const u = await user("ada", { idVerificationStatus: "PENDING" });
    await rejects(createListing(u.id, listingInput as never), "FORBIDDEN", NOT_VERIFIED);
    await rejects(createRequest(u.id, requestInput as never), "FORBIDDEN", NOT_VERIFIED);

    const donor = await user("donor", { idVerificationStatus: "VERIFIED" });
    const asker = await user("asker", { idVerificationStatus: "VERIFIED" });
    const l = await createListing(donor.id, listingInput as never);
    const r = await createRequest(asker.id, requestInput as never);
    await prisma.user.update({ where: { id: donor.id }, data: { idVerificationStatus: "FAILED" } });
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: r.id } as never), "FORBIDDEN", NOT_VERIFIED);
  });

  it("the error maps to a translation key", () => {
    expect(errorKey(NOT_VERIFIED, "FORBIDDEN")).toBe("notVerified");
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

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
  deleteIdObjects: async (keys: string[]) => {
    if (storage.fail) throw new Error("R2 down");
    storage.deleted.push(...keys);
  },
}));

import { prisma as _prisma } from "@/neon-db";
import { runPurge, ABANDONED_REASON } from "@/lib/purge";
import { GET, POST } from "@/app/api/cron/purge/route";

const prisma = _prisma as unknown as PrismaClient;
const DAY = 86_400_000;
const NOW = new Date("2026-12-01T03:00:00Z");

let n = 0;
const user = (extra: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: { email: `u${++n}@t.test`, firstName: "u", lastName: "T", name: "u T", countryCode: "NG", ...extra },
  });
const row = (userId: string, extra: Record<string, unknown> = {}) =>
  prisma.idVerification.create({
    data: {
      userId, countryCode: "NG", documentType: "NATIONAL_ID", fullNameOnId: "u T",
      frontKey: `id/${userId}/f.jpg`, backKey: `id/${userId}/b.jpg`, selfieKey: `id/${userId}/s.jpg`,
      ...extra,
    } as never,
  });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
  storage.deleted = [];
  storage.fail = false;
});
afterAll(() => testDb.stop());

describe("purge expired images", () => {
  it("deletes due objects, nulls the keys and stamps imagesPurgedAt", async () => {
    const u = await user({ idVerificationStatus: "VERIFIED" });
    const r = await row(u.id, { status: "VERIFIED", decidedAt: new Date(NOW.getTime() - 31 * DAY), imagesPurgeAt: new Date(NOW.getTime() - DAY) });
    expect(await runPurge(NOW)).toEqual({ abandoned: 0, purged: 1, objects: 3, hashesExpired: 0 });
    expect(storage.deleted.sort()).toEqual([`id/${u.id}/b.jpg`, `id/${u.id}/f.jpg`, `id/${u.id}/s.jpg`]);
    expect(await prisma.idVerification.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      frontKey: null, backKey: null, selfieKey: null, imagesPurgedAt: NOW, status: "VERIFIED",
    });
    // The user stays verified: purging evidence never changes the decision.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("VERIFIED");
  });

  it("leaves images that are not due yet, and ones with no schedule (still pending)", async () => {
    const a = await user();
    const b = await user();
    await row(a.id, { status: "VERIFIED", imagesPurgeAt: new Date(NOW.getTime() + DAY) });
    await row(b.id); // PENDING, no purge date
    expect(await runPurge(NOW)).toEqual({ abandoned: 0, purged: 0, objects: 0, hashesExpired: 0 });
    expect(storage.deleted).toEqual([]);
  });

  it("is idempotent: a second run does nothing", async () => {
    const u = await user();
    await row(u.id, { status: "FAILED", imagesPurgeAt: new Date(NOW.getTime() - DAY) });
    await runPurge(NOW);
    storage.deleted = [];
    expect(await runPurge(NOW)).toEqual({ abandoned: 0, purged: 0, objects: 0, hashesExpired: 0 });
    expect(storage.deleted).toEqual([]);
  });

  it("keeps the keys when deletion fails, so the next run retries", async () => {
    const u = await user();
    const r = await row(u.id, { status: "FAILED", imagesPurgeAt: new Date(NOW.getTime() - DAY) });
    storage.fail = true;
    await expect(runPurge(NOW)).rejects.toThrow("R2 down");
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: r.id } })).frontKey).not.toBeNull();
    storage.fail = false;
    expect((await runPurge(NOW)).purged).toBe(1);
  });

  it("handles a passport, which has no back image", async () => {
    const u = await user();
    await row(u.id, { status: "FAILED", documentType: "PASSPORT", backKey: null, imagesPurgeAt: new Date(NOW.getTime() - DAY) });
    expect(await runPurge(NOW)).toEqual({ abandoned: 0, purged: 1, objects: 2, hashesExpired: 0 });
  });
});

describe("abandoned submissions", () => {
  it("closes a PENDING submission older than 30 days, lets the person retry, and purges its images", async () => {
    const u = await user({ idVerificationStatus: "PENDING" });
    const old = await row(u.id, { createdAt: new Date(NOW.getTime() - 31 * DAY) });
    const result = await runPurge(NOW);
    expect(result).toEqual({ abandoned: 1, purged: 1, objects: 3, hashesExpired: 0 });
    expect(await prisma.idVerification.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
      status: "FAILED", rejectionReason: ABANDONED_REASON, frontKey: null, imagesPurgedAt: NOW,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("FAILED");
  });

  it("leaves a recent PENDING submission alone", async () => {
    const u = await user({ idVerificationStatus: "PENDING" });
    const r = await row(u.id, { createdAt: new Date(NOW.getTime() - 29 * DAY) });
    expect(await runPurge(NOW)).toEqual({ abandoned: 0, purged: 0, objects: 0, hashesExpired: 0 });
    expect((await prisma.idVerification.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("PENDING");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).idVerificationStatus).toBe("PENDING");
  });
});

describe("document hash retention", () => {
  it("deletes expired hashes and keeps the rest", async () => {
    await prisma.blockedDocument.createMany({
      data: [
        { docNumberHash: "old", countryCode: "NG", expiresAt: new Date(NOW.getTime() - DAY) },
        { docNumberHash: "new", countryCode: "NG", expiresAt: new Date(NOW.getTime() + DAY) },
      ],
    });
    expect((await runPurge(NOW)).hashesExpired).toBe(1);
    expect((await prisma.blockedDocument.findMany()).map((b) => b.docNumberHash)).toEqual(["new"]);
  });
});

describe("cron route", () => {
  const req = (auth?: string, method = "GET") =>
    new Request("http://localhost/api/cron/purge", { method, headers: auth ? { authorization: auth } : {} });

  it("refuses everything when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(503);
    expect((await GET(req())).status).toBe(503);
  });

  it("rejects a missing or wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value-123");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect((await GET(req("s3cret-value-123"))).status).toBe(401);
    expect(storage.deleted).toEqual([]);
  });

  it("runs the purge with the right token, on GET and POST", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value-123");
    const u = await user();
    await row(u.id, { status: "FAILED", imagesPurgeAt: new Date(Date.now() - DAY) });
    const res = await GET(req("Bearer s3cret-value-123"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ abandoned: 0, purged: 1, objects: 3, hashesExpired: 0 });
    expect((await POST(req("Bearer s3cret-value-123", "POST"))).status).toBe(200);
    vi.unstubAllEnvs();
  });
});

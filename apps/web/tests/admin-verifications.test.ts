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
import { submitVerification, approveVerification, revealVerificationImages } from "@/lib/verification";
import { setCountryEnabled } from "@/lib/admin";
import {
  getAdminOverview,
  getVerificationForReview,
  listAdminActions,
  listPendingVerifications,
} from "@/lib/admin-queries";
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

const submit = (u: { id: string }, docNumber = "12345678901", extra: Record<string, unknown> = {}) =>
  submitVerification(
    u.id,
    submitVerificationSchema.parse({
      documentType: "NATIONAL_ID",
      fullNameOnId: "Ada T",
      docNumber,
      frontKey: `id/${u.id}/f.jpg`,
      backKey: `id/${u.id}/b.jpg`,
      selfieKey: `id/${u.id}/s.jpg`,
      ...extra,
    }),
  );

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("pending queue", () => {
  it("lists oldest first, filters by country, and counts per country", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const b = await user("kofi", { countryCode: "GH" });
    const c = await user("bola");
    const ra = await submit(a, "11111111111");
    const rb = await submit(b, "GH123456", { documentType: "NATIONAL_ID" });
    const rc = await submit(c, "22222222222");
    // Make the order unambiguous: ada oldest, then kofi, then bola.
    for (const [i, r] of [ra, rb, rc].entries())
      await prisma.idVerification.update({ where: { id: r.id }, data: { createdAt: new Date(Date.UTC(2026, 10, 1 + i)) } });

    const all = await listPendingVerifications(admin.id);
    expect(all.rows.map((r) => r.id)).toEqual([ra.id, rb.id, rc.id]);
    expect(all.countries).toEqual([{ code: "GH", count: 1 }, { code: "NG", count: 2 }]);
    const ng = await listPendingVerifications(admin.id, { country: "ng" });
    expect(ng.rows.map((r) => r.id)).toEqual([ra.id, rc.id]);
  });

  it("flags a document number already used on another account", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const b = await user("bola");
    const c = await user("chi");
    await submit(a, "33333333333");
    await submit(b, "3333-3333-333"); // same number, typed differently
    await submit(c, "44444444444");
    const { rows } = await listPendingVerifications(admin.id);
    const flagged = Object.fromEntries(rows.map((r) => [r.userId, r.duplicate]));
    expect(flagged).toEqual({ [a.id]: true, [b.id]: true, [c.id]: false });
  });

  it("is admin only", async () => {
    const u = await user("ada");
    await rejects(listPendingVerifications(u.id), "FORBIDDEN", "Admins only.");
    await rejects(getAdminOverview(u.id), "FORBIDDEN");
    await rejects(listAdminActions(u.id), "FORBIDDEN");
  });
});

describe("review page data", () => {
  it("returns the country checklist, check flags and duplicates", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const b = await user("bola");
    const ra = await submit(a, "55555555555", { fullNameOnId: "Someone Else" });
    await submit(b, "55555555555");
    const v = await getVerificationForReview(admin.id, ra.id);
    expect(v.nameMatches).toBe(false);
    expect(v.countryMatches).toBe(true);
    expect(v.duplicates).toHaveLength(1);
    expect(v.checklist.some((c) => c.includes("NIN"))).toBe(true); // Nigeria's extras
    expect(v).not.toHaveProperty("frontKey"); // keys are never sent to the page
    expect(v).not.toHaveProperty("backKey");
    expect(v).not.toHaveProperty("docNumberHash");
    await rejects(getVerificationForReview(admin.id, "nope"), "NOT_FOUND");
  });
});

describe("viewing images", () => {
  it("signs URLs and logs each view", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const r = await submit(a);
    const out = await revealVerificationImages(admin.id, r.id);
    expect(out.front).toContain(`id/${a.id}/f.jpg`);
    expect(out.back).toContain("b.jpg");
    expect(out.expiresInSeconds).toBe(60);
    await revealVerificationImages(admin.id, r.id);
    expect(await prisma.adminAction.count({ where: { action: "id.view_images", targetId: r.id, actorId: admin.id } })).toBe(2);
  });

  it("refuses non-admins, your own documents, and purged images", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const r = await submit(a);
    await rejects(revealVerificationImages(a.id, r.id), "FORBIDDEN", "Admins only.");
    const mine = await submit(admin, "66666666666");
    await rejects(revealVerificationImages(admin.id, mine.id), "FORBIDDEN", "You can't review your own verification.");
    await prisma.idVerification.update({ where: { id: r.id }, data: { frontKey: null, backKey: null, selfieKey: null, imagesPurgedAt: new Date() } });
    await rejects(revealVerificationImages(admin.id, r.id), "INVALID", "These images have been deleted.");
    expect(await prisma.adminAction.count({ where: { action: "id.view_images" } })).toBe(0);
  });
});

describe("activity log", () => {
  it("records decisions and country toggles, newest first, with filtering", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    const a = await user("ada");
    const r = await submit(a);
    await approveVerification(admin.id, r.id);
    await setCountryEnabled(admin.id, "TZ", true);
    await setCountryEnabled(admin.id, "TZ", true); // no change, so not logged again
    await setCountryEnabled(admin.id, "TZ", false);

    const log = await listAdminActions(admin.id);
    expect(log.rows.map((x) => x.action)).toEqual(["country.disable", "country.enable", "id.approve"]);
    expect(log.rows[0]).toMatchObject({ targetType: "Country", targetId: "TZ" });
    expect(log.rows[0].actor.name).toBe("admin T");
    expect((await listAdminActions(admin.id, { action: "id.approve" })).rows).toHaveLength(1);

    const o = await getAdminOverview(admin.id);
    expect(o.pending).toBe(0);
    expect(o.recent).toHaveLength(3);
  });

  it("a refused change leaves no log entry", async () => {
    const admin = await user("admin", { role: "ADMIN" });
    await prisma.$executeRawUnsafe('DELETE FROM "EnabledCountry" WHERE "code" <> \'NG\'');
    await rejects(setCountryEnabled(admin.id, "NG", false), "INVALID", "At least one country must stay enabled.");
    expect(await prisma.adminAction.count()).toBe(0);
  });
});

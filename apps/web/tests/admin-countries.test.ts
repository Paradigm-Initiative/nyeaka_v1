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
import { assertAdminOnly, isAdmin, setCountryEnabled } from "@/lib/admin";
import { getEnabledCountryCodes, isEnabledCountry } from "@/lib/enabled-countries";
import { prepareNewUser, requirePostingCountry } from "@/lib/country-rules";

const prisma = _prisma as unknown as PrismaClient;
const SEEDED = ["CM", "GH", "KE", "NG", "SN", "ZM", "ZW"];

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, idVerificationStatus: "VERIFIED", countryCode: "NG", ...extra } });

async function rejects(p: Promise<unknown>, code: string, msg?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toBe(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
  await prisma.$executeRawUnsafe('DELETE FROM "EnabledCountry"');
  await prisma.$executeRawUnsafe(`INSERT INTO "EnabledCountry"("code") VALUES ${SEEDED.map((c) => `('${c}')`).join(",")}`);
});
afterAll(() => testDb.stop());

describe("the enabled list", () => {
  it("is read from the database, sorted, and case-insensitive to look up", async () => {
    expect(await getEnabledCountryCodes()).toEqual(SEEDED);
    expect(await isEnabledCountry("gh")).toBe(true);
    expect(await isEnabledCountry(" ZW ")).toBe(true);
    expect(await isEnabledCountry("EG")).toBe(false);
    expect(await isEnabledCountry(null)).toBe(false);
    expect(await isEnabledCountry("")).toBe(false);
  });

  it("the migration seeds Nigeria, Ghana, Kenya, Cameroon, Senegal, Zambia and Zimbabwe", async () => {
    // The in-memory database runs the real migrations first; this test table was reset in beforeEach,
    // so check the migration file's own list instead.
    const fs = await import("node:fs");
    const sql = fs.readFileSync("prisma/migrations/20261113130000_enabled_countries/migration.sql", "utf8");
    const codes = [...sql.matchAll(/\('([A-Z]{2})'\)/g)].map((m) => m[1]).sort();
    expect(codes).toEqual(SEEDED);
  });

  it("the database refuses a malformed code", async () => {
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "EnabledCountry"("code") VALUES ('Ghana')`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`INSERT INTO "EnabledCountry"("code") VALUES ('gh')`)).rejects.toThrow();
  });
});

describe("admin access", () => {
  it("only an admin passes assertAdminOnly", async () => {
    const [admin, member] = [await user("root", { staffRole: "ADMIN", twoFactorEnabled: true }), await user("mem", { role: "BOTH" })];
    await assertAdminOnly(admin.id);
    expect(await isAdmin(admin.id)).toBe(true);
    expect(await isAdmin(member.id)).toBe(false);
    expect(await isAdmin("missing")).toBe(false);
    await rejects(assertAdminOnly(member.id), "FORBIDDEN");
    await rejects(assertAdminOnly("missing"), "FORBIDDEN");
  });

  it("a non-admin can't change the list, and nothing changes", async () => {
    const member = await user("mem", { role: "BOTH" });
    await rejects(setCountryEnabled(member.id, "EG", true), "FORBIDDEN");
    await rejects(setCountryEnabled(member.id, "NG", false), "FORBIDDEN");
    expect(await getEnabledCountryCodes()).toEqual(SEEDED);
  });
});

describe("switching countries on and off", () => {
  it("an admin enables a country, records who, and it takes effect straight away", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    const eg = await user("eg", { countryCode: "EG" });
    await rejects(requirePostingCountry(eg.id), "INVALID");
    expect(await prepareNewUser({ countryCode: "EG" })).toMatchObject({ ok: false });

    const list = await setCountryEnabled(admin.id, " eg ", true);
    expect(list).toContain("EG");
    expect(await requirePostingCountry(eg.id)).toBe("EG");
    expect(await prepareNewUser({ countryCode: "EG" })).toMatchObject({ ok: true, countryCode: "EG" });
    expect(await prisma.enabledCountry.findUniqueOrThrow({ where: { code: "EG" } })).toMatchObject({ enabledById: admin.id });
  });

  it("enabling twice is harmless and keeps the first record", async () => {
    const [a1, a2] = [await user("a1", { staffRole: "ADMIN", twoFactorEnabled: true }), await user("a2", { staffRole: "ADMIN", twoFactorEnabled: true })];
    await setCountryEnabled(a1.id, "EG", true);
    await setCountryEnabled(a2.id, "EG", true);
    expect(await prisma.enabledCountry.count({ where: { code: "EG" } })).toBe(1);
    expect((await prisma.enabledCountry.findUniqueOrThrow({ where: { code: "EG" } })).enabledById).toBe(a1.id);
  });

  it("disabling stops posting and sign-up there", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    const gh = await user("gh", { countryCode: "GH" });
    expect(await requirePostingCountry(gh.id)).toBe("GH");

    const list = await setCountryEnabled(admin.id, "GH", false);
    expect(list).not.toContain("GH");
    await rejects(requirePostingCountry(gh.id), "INVALID");
    expect(await prepareNewUser({ countryCode: "GH" })).toMatchObject({ ok: false });
  });

  it("disabling a country that isn't on does nothing", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    expect(await setCountryEnabled(admin.id, "EG", false)).toEqual(SEEDED);
  });

  it("refuses an unknown code, and malformed ones", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    for (const bad of ["GB", "XX", "", "Nigeria", "N"])
      await rejects(setCountryEnabled(admin.id, bad, true), "INVALID");
    expect(await getEnabledCountryCodes()).toEqual(SEEDED);
  });

  it("at least one country must stay enabled", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    for (const c of SEEDED.slice(1)) await setCountryEnabled(admin.id, c, false);
    expect(await getEnabledCountryCodes()).toEqual([SEEDED[0]]);
    await rejects(setCountryEnabled(admin.id, SEEDED[0], false), "INVALID", "At least one country must stay enabled.");
    expect(await getEnabledCountryCodes()).toEqual([SEEDED[0]]);
  });

  it("switching off the last two at the same time leaves one", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    for (const c of SEEDED.slice(2)) await setCountryEnabled(admin.id, c, false);
    const [x, y] = SEEDED.slice(0, 2);
    const results = await Promise.allSettled([setCountryEnabled(admin.id, x, false), setCountryEnabled(admin.id, y, false)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.enabledCountry.count()).toBe(1);
  });

  it("deleting the admin who enabled a country keeps the country", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    await prisma.enabledCountry.create({ data: { code: "EG", enabledById: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
    expect(await prisma.enabledCountry.findUniqueOrThrow({ where: { code: "EG" } })).toMatchObject({ enabledById: null });
  });

  it("an admin with logged actions can't be hard-deleted, so the audit trail keeps its actor", async () => {
    const admin = await user("root", { staffRole: "ADMIN", twoFactorEnabled: true });
    await setCountryEnabled(admin.id, "EG", true);
    expect(await prisma.adminAction.count({ where: { actorId: admin.id, action: "country.enable", targetId: "EG" } })).toBe(1);
    await expect(prisma.user.delete({ where: { id: admin.id } })).rejects.toThrow();
  });
});

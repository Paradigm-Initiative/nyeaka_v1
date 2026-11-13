import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});
vi.mock("@/lib/email", () => ({ sendEmail: async () => {} }));

import { prisma as _prisma } from "@/neon-db";
import { auth } from "@/lib/auth";
import { LEGAL_VERSION, termsAcceptance } from "@/lib/legal";
import { signUpSchema } from "@/validations/auth-validation";

const prisma = _prisma as unknown as PrismaClient;

const body = (extra: Record<string, unknown> = {}) => ({
  email: `p${Math.random().toString(36).slice(2)}@t.test`,
  password: "Str0ng!Passw0rd",
  name: "Ada Eze",
  firstName: "Ada",
  lastName: "Eze",
  countryCode: "NG",
  locale: "en",
  ...extra,
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("terms acceptance at sign-up", () => {
  it("records when and which version was accepted", async () => {
    const before = Date.now();
    await auth.api.signUpEmail({ body: body({ termsVersion: LEGAL_VERSION }) });
    const u = await prisma.user.findFirstOrThrow();
    expect(u.termsVersion).toBe(LEGAL_VERSION);
    expect(u.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(u.countryCode).toBe("NG"); // the other sign-up checks still ran
  });

  it("refuses to create an account when the box wasn't ticked, however the API is called", async () => {
    for (const extra of [{}, { termsVersion: "1999-01-01" }, { termsVersion: "" }]) {
      await expect(auth.api.signUpEmail({ body: body(extra) })).rejects.toMatchObject({ body: { code: "TERMS_NOT_ACCEPTED" } });
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it("a client can't set the acceptance time itself", async () => {
    await expect(
      auth.api.signUpEmail({ body: body({ termsVersion: LEGAL_VERSION, termsAcceptedAt: "2000-01-01" }) }),
    ).rejects.toThrow(/termsAcceptedAt is not allowed/);
    expect(await prisma.user.count()).toBe(0);
  });

  it("termsAcceptance only accepts the current version", () => {
    expect(termsAcceptance(LEGAL_VERSION)).toMatchObject({ termsVersion: LEGAL_VERSION });
    for (const v of [true, false, undefined, null, "", "true", 1, "1999-01-01"]) expect(termsAcceptance(v)).toBeNull();
  });

  it("the form schema needs the box ticked", () => {
    const ok = { email: "a@b.co", firstName: "Ada", lastName: "Eze", countryCode: "NG", password: "Str0ng!Passw0rd", confirmPassword: "Str0ng!Passw0rd" };
    expect(signUpSchema.safeParse({ ...ok, acceptedTerms: true }).success).toBe(true);
    const r = signUpSchema.safeParse({ ...ok, acceptedTerms: false });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("acceptTerms");
  });
});

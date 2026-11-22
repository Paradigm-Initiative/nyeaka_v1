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
import { assertAdminOnly, assertStaff, getStaffRole, setCountryEnabled } from "@/lib/admin";
import { LAST_ADMIN, setStaffRole } from "@/lib/staff";
import { createFirstAdmin } from "@/lib/first-admin";
import { getAdminOverview, listAdminActions } from "@/lib/admin-queries";
import { listOpenReports, suspendUser, unsuspendUser, liftUserRestriction } from "@/lib/moderation";
import { deleteAccount } from "@/lib/account";
import { auth } from "@/lib/auth";

const prisma = _prisma as unknown as PrismaClient;

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, countryCode: "NG", role: "BOTH", ...extra } });

async function rejects(p: Promise<unknown>, code: string, msg?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toBe(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("staff tiers", () => {
  it("staff keep their everyday role, and an ordinary member is neither tier", async () => {
    const reviewer = await user("rev", { staffRole: "REVIEWER", role: "DONOR" });
    const member = await user("mem");
    expect(reviewer.role).toBe("DONOR");
    expect(await getStaffRole(reviewer.id)).toBe("REVIEWER");
    expect(await getStaffRole(member.id)).toBeNull();
    expect(await getStaffRole("missing")).toBeNull();
    await rejects(assertStaff(member.id), "FORBIDDEN");
  });

  it("a reviewer passes assertStaff but not assertAdminOnly", async () => {
    const reviewer = await user("rev", { staffRole: "REVIEWER" });
    const admin = await user("adm", { staffRole: "ADMIN" });
    expect(await assertStaff(reviewer.id)).toBe("REVIEWER");
    expect(await assertStaff(admin.id)).toBe("ADMIN");
    await rejects(assertAdminOnly(reviewer.id), "FORBIDDEN");
    await assertAdminOnly(admin.id);
  });

  it("a suspended staff member has no access", async () => {
    const reviewer = await user("rev", { staffRole: "REVIEWER", suspendedAt: new Date() });
    await rejects(assertStaff(reviewer.id), "FORBIDDEN");
  });

  it("reviewers can read the ID queue overview and reports, but not the log, countries or suspension", async () => {
    const reviewer = await user("rev", { staffRole: "REVIEWER" });
    const target = await user("tgt");
    const overview = await getAdminOverview(reviewer.id);
    expect(overview.staffRole).toBe("REVIEWER");
    expect(overview.recent).toEqual([]);
    await listOpenReports(reviewer.id);
    await rejects(listAdminActions(reviewer.id), "FORBIDDEN");
    await rejects(setCountryEnabled(reviewer.id, "EG", true), "FORBIDDEN");
    await rejects(suspendUser(reviewer.id, target.id, "no good reason"), "FORBIDDEN");
    await rejects(unsuspendUser(reviewer.id, target.id), "FORBIDDEN");
    await rejects(liftUserRestriction(reviewer.id, target.id), "FORBIDDEN");
    await rejects(setStaffRole(reviewer.id, target.id, "REVIEWER"), "FORBIDDEN");
  });

  it("staff can't be suspended or delete their own account", async () => {
    const admin = await user("adm", { staffRole: "ADMIN" });
    const reviewer = await user("rev", { staffRole: "REVIEWER" });
    await rejects(suspendUser(admin.id, reviewer.id, "testing this"), "FORBIDDEN");
    await rejects(deleteAccount(reviewer.id, reviewer.email), "FORBIDDEN");
  });
});

describe("changing staff roles", () => {
  it("an admin can add a reviewer and it is logged", async () => {
    const admin = await user("adm", { staffRole: "ADMIN" });
    const person = await user("per");
    await setStaffRole(admin.id, person.id, "REVIEWER");
    expect(await getStaffRole(person.id)).toBe("REVIEWER");
    const log = await prisma.adminAction.findFirst({ where: { action: "staff.set_role", targetId: person.id } });
    expect(log?.meta).toEqual({ from: null, to: "REVIEWER" });
  });

  it("removing staff access ends their sessions", async () => {
    const admin = await user("adm", { staffRole: "ADMIN" });
    const reviewer = await user("rev", { staffRole: "REVIEWER" });
    await prisma.session.create({ data: { id: "sess-1", userId: reviewer.id, token: "tok", expiresAt: new Date(Date.now() + 1e6) } });
    await setStaffRole(admin.id, reviewer.id, null);
    expect(await getStaffRole(reviewer.id)).toBeNull();
    expect(await prisma.session.count({ where: { userId: reviewer.id } })).toBe(0);
  });

  it("the last admin can't be demoted or removed, even by themselves", async () => {
    const admin = await user("adm", { staffRole: "ADMIN" });
    await rejects(setStaffRole(admin.id, admin.id, null), "FORBIDDEN", LAST_ADMIN);
    await rejects(setStaffRole(admin.id, admin.id, "REVIEWER"), "FORBIDDEN", LAST_ADMIN);
    expect(await getStaffRole(admin.id)).toBe("ADMIN");
  });

  it("with two admins one can step down, but then the other is the last", async () => {
    const [a, b] = [await user("a", { staffRole: "ADMIN" }), await user("b", { staffRole: "ADMIN" })];
    await setStaffRole(a.id, b.id, "REVIEWER");
    await rejects(setStaffRole(a.id, a.id, null), "FORBIDDEN", LAST_ADMIN);
  });

  it("two admins demoting each other at once leaves one admin", async () => {
    const [a, b] = [await user("a", { staffRole: "ADMIN" }), await user("b", { staffRole: "ADMIN" })];
    const results = await Promise.allSettled([setStaffRole(a.id, b.id, null), setStaffRole(b.id, a.id, null)]);
    expect(await prisma.user.count({ where: { staffRole: "ADMIN" } })).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
  });
});

describe("no public way to set a role", () => {
  it("sign-up and update-user can't carry staffRole (input is disabled)", () => {
    const fields = (auth.options.user as { additionalFields: Record<string, { input?: boolean }> }).additionalFields;
    expect(fields.staffRole.input).toBe(false);
    expect(fields.role).toBeUndefined();
  });

  it("the sign-up action's schema has no role field", async () => {
    const fs = await import("node:fs");
    const files = ["validations/auth-validation.ts"].filter((f) => fs.existsSync(f));
    for (const f of files) expect(fs.readFileSync(f, "utf8")).not.toMatch(/staffRole|role\s*:/);
  });
});

describe("first admin", () => {
  it("creates the admin and sends a set-password link", async () => {
    const send = vi.fn(async () => {});
    const r = await createFirstAdmin("Boss@Example.org ", { sendSetPasswordLink: send });
    expect(r).toEqual({ created: true, email: "boss@example.org", promoted: false });
    expect(send).toHaveBeenCalledWith("boss@example.org");
    expect((await prisma.user.findUnique({ where: { email: "boss@example.org" } }))?.staffRole).toBe("ADMIN");
  });

  it("does nothing once any admin exists, so it is safe to run on every deploy", async () => {
    await user("adm", { staffRole: "ADMIN" });
    const send = vi.fn(async () => {});
    expect(await createFirstAdmin("other@example.org", { sendSetPasswordLink: send })).toEqual({ created: false, reason: "admin-exists" });
    expect(send).not.toHaveBeenCalled();
    expect(await prisma.user.count({ where: { email: "other@example.org" } })).toBe(0);
  });

  it("promotes an existing account without touching its other data", async () => {
    const u = await user("exists", { email: "me@example.org", role: "DONOR" });
    const r = await createFirstAdmin("me@example.org", { sendSetPasswordLink: async () => {} });
    expect(r).toMatchObject({ created: true, promoted: true });
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.staffRole).toBe("ADMIN");
    expect(after?.role).toBe("DONOR");
  });

  it("does nothing without an email, and two runs at once make one admin", async () => {
    expect(await createFirstAdmin(undefined)).toEqual({ created: false, reason: "no-email" });
    const rs = await Promise.all([1, 2, 3].map((i) => createFirstAdmin(`x${i}@example.org`, { sendSetPasswordLink: async () => {} })));
    expect(rs.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.user.count({ where: { staffRole: "ADMIN" } })).toBe(1);
  });
});

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
import { assertAdminOnly, assertStaff, getStaffAccess, TWO_FACTOR_REQUIRED } from "@/lib/admin";
import { setStaffRole, resetTwoFactor, listStaff } from "@/lib/staff";
import {
  acceptInvite, checkInvite, hashToken, INVITE_TTL_MS, inviteStaff, isStaffEmailAllowed, listOpenInvites, revokeInvite,
} from "@/lib/staff-invites";
import { staffInviteEmail } from "@/lib/email-templates";

const prisma = _prisma as unknown as PrismaClient;
const hash = async (pw: string) => `hashed:${pw}`;
const PW = "a-long-enough-password";

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, countryCode: "GH", role: "BOTH", ...extra } });

async function rejects(p: Promise<unknown>, code: string, msg?: string | RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (typeof msg === "string") expect((err as ServiceError).message).toBe(msg);
  else if (msg) expect((err as ServiceError).message).toMatch(msg);
}

const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;
const admin = () => user("adm", { staffRole: "ADMIN", twoFactorEnabled: true });

beforeEach(async () => {
  process.env.STAFF_EMAIL_DOMAINS = "pin.org, Example.ORG";
  await prisma.$executeRawUnsafe('TRUNCATE "user" CASCADE');
});
afterAll(() => testDb.stop());

describe("domain restriction", () => {
  it("allows only exact configured domains, case-insensitively", () => {
    expect(isStaffEmailAllowed("a@pin.org")).toBe(true);
    expect(isStaffEmailAllowed("A@PIN.ORG")).toBe(true);
    expect(isStaffEmailAllowed("a@example.org")).toBe(true);
    expect(isStaffEmailAllowed("a@evilpin.org")).toBe(false);
    expect(isStaffEmailAllowed("a@pin.org.evil.com")).toBe(false);
    expect(isStaffEmailAllowed("a@sub.pin.org")).toBe(false);
    expect(isStaffEmailAllowed("pin.org")).toBe(false);
  });

  it("refuses an invite outside the domain, and every invite when no domain is configured", async () => {
    const a = await admin();
    await rejects(inviteStaff(a.id, "x@gmail.com", "REVIEWER"), "INVALID", /pin\.org, example\.org/);
    delete process.env.STAFF_EMAIL_DOMAINS;
    await rejects(inviteStaff(a.id, "x@pin.org", "REVIEWER"), "INVALID", /switched off/);
    expect(await prisma.staffInvite.count()).toBe(0);
  });

  it("only admins can invite, and not someone who is already staff", async () => {
    const reviewer = await user("rev", { staffRole: "REVIEWER", twoFactorEnabled: true });
    await rejects(inviteStaff(reviewer.id, "x@pin.org", "REVIEWER"), "FORBIDDEN", "Admins only.");
    const a = await admin();
    const staff = await user("s", { email: "s@pin.org", staffRole: "REVIEWER" });
    await rejects(inviteStaff(a.id, staff.email, "ADMIN"), "INVALID", "That person is already staff.");
  });
});

describe("invite lifetime", () => {
  it("stores only a hash, lasts 72 hours, and the link carries the token", async () => {
    const a = await admin();
    const inv = await inviteStaff(a.id, " New@PIN.org ", "REVIEWER");
    const token = tokenOf(inv.url);
    const row = await prisma.staffInvite.findFirstOrThrow();
    expect(row.email).toBe("new@pin.org");
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(INVITE_TTL_MS - 5000);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(INVITE_TTL_MS);
    expect(INVITE_TTL_MS).toBe(72 * 3600_000);
    expect(row.invitedById).toBe(a.id);
  });

  it("an expired invite can't be used", async () => {
    const a = await admin();
    const token = tokenOf((await inviteStaff(a.id, "late@pin.org", "REVIEWER")).url);
    await prisma.staffInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await checkInvite(token)).toEqual({ ok: false, reason: "expired" });
    await rejects(acceptInvite(token, { firstName: "Late", lastName: "One", password: PW }, hash), "INVALID", /expired/);
    expect(await prisma.user.count({ where: { email: "late@pin.org" } })).toBe(0);
  });

  it("works once only, even when used at the same moment", async () => {
    const a = await admin();
    const token = tokenOf((await inviteStaff(a.id, "once@pin.org", "REVIEWER")).url);
    const results = await Promise.allSettled([1, 2, 3].map((i) => acceptInvite(token, { firstName: "Once", lastName: `Try${i}`, password: PW }, hash)).flat());
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: "once@pin.org" } })).toBe(1);
    await rejects(acceptInvite(token, { firstName: "Once", lastName: "Again", password: PW }, hash), "INVALID", /already been used/);
  });

  it("an unknown token is invalid", async () => {
    expect(await checkInvite("nope")).toEqual({ ok: false, reason: "invalid" });
    expect(await checkInvite("")).toEqual({ ok: false, reason: "invalid" });
  });

  it("a newer invite cancels the older one, and an admin can cancel an open one", async () => {
    const a = await admin();
    const t1 = tokenOf((await inviteStaff(a.id, "twice@pin.org", "REVIEWER")).url);
    const second = await inviteStaff(a.id, "twice@pin.org", "ADMIN");
    expect(await checkInvite(t1)).toEqual({ ok: false, reason: "revoked" });
    expect(await checkInvite(tokenOf(second.url))).toMatchObject({ ok: true, role: "ADMIN" });
    expect(await listOpenInvites(a.id)).toHaveLength(1);
    await revokeInvite(a.id, second.id);
    expect(await checkInvite(tokenOf(second.url))).toEqual({ ok: false, reason: "revoked" });
    await rejects(revokeInvite(a.id, second.id), "INVALID");
  });
});

describe("accepting", () => {
  it("creates the account with the invited role and a credential, then logs it", async () => {
    const a = await admin();
    const token = tokenOf((await inviteStaff(a.id, "new@pin.org", "REVIEWER")).url);
    const r = await acceptInvite(token, { firstName: "Nia", lastName: "Okoro", password: PW }, hash);
    expect(r).toEqual({ email: "new@pin.org", promoted: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "new@pin.org" }, include: { accounts: true } });
    expect(u).toMatchObject({ staffRole: "REVIEWER", emailVerified: true, name: "Nia Okoro", countryCode: "GH", twoFactorEnabled: false });
    expect(u.accounts[0]).toMatchObject({ providerId: "credential", password: `hashed:${PW}` });
    expect(await prisma.adminAction.count({ where: { action: "staff.accept_invite", actorId: u.id } })).toBe(1);
  });

  it("checks the name and password before using up the invite", async () => {
    const a = await admin();
    const token = tokenOf((await inviteStaff(a.id, "weak@pin.org", "REVIEWER")).url);
    await rejects(acceptInvite(token, { firstName: "Weak", lastName: "Pw", password: "short" }, hash), "INVALID", /at least 10/);
    await rejects(acceptInvite(token, { firstName: "", lastName: "Pw", password: PW }, hash), "INVALID", /name/);
    expect(await checkInvite(token)).toMatchObject({ ok: true });
  });

  it("promotes an existing account without touching its password", async () => {
    const a = await admin();
    const existing = await user("old", { email: "old@pin.org", role: "DONOR" });
    await prisma.account.create({ data: { id: "acc-old", accountId: existing.id, providerId: "credential", userId: existing.id, password: "their-own-hash" } });
    const token = tokenOf((await inviteStaff(a.id, "old@pin.org", "ADMIN")).url);
    expect(await acceptInvite(token, { firstName: "", lastName: "", password: "" }, hash)).toMatchObject({ promoted: true });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: existing.id }, include: { accounts: true } });
    expect(u).toMatchObject({ staffRole: "ADMIN", role: "DONOR" });
    expect(u.accounts[0].password).toBe("their-own-hash");
  });

  it("the invite email is English and carries the link, escaped", () => {
    const mail = staffInviteEmail({ role: "REVIEWER", inviterName: "<b>Ada</b>", url: "https://x.test/accept-invite?token=abc", hours: 72 });
    expect(mail.html).toContain("72 hours");
    expect(mail.html).toContain("a reviewer");
    expect(mail.html).toContain("https://x.test/accept-invite?token=abc");
    expect(mail.html).not.toContain("<b>Ada</b>");
  });
});

describe("two-factor gate", () => {
  it("staff without two-factor can't use any staff or admin service", async () => {
    const a = await user("a", { staffRole: "ADMIN" });
    const r = await user("r", { staffRole: "REVIEWER" });
    await rejects(assertStaff(a.id), "FORBIDDEN", TWO_FACTOR_REQUIRED);
    await rejects(assertStaff(r.id), "FORBIDDEN", TWO_FACTOR_REQUIRED);
    await rejects(assertAdminOnly(a.id), "FORBIDDEN", TWO_FACTOR_REQUIRED);
    expect(await getStaffAccess(a.id)).toEqual({ role: "ADMIN", twoFactor: false });
    await rejects(inviteStaff(a.id, "x@pin.org", "REVIEWER"), "FORBIDDEN", TWO_FACTOR_REQUIRED);
  });

  it("turning two-factor on opens access", async () => {
    const a = await user("a", { staffRole: "ADMIN" });
    await prisma.user.update({ where: { id: a.id }, data: { twoFactorEnabled: true } });
    await assertAdminOnly(a.id);
  });
});

describe("removing staff and recovering from lockout", () => {
  it("removal ends their sessions at once and access with them", async () => {
    const a = await admin();
    const rev = await user("rev", { staffRole: "REVIEWER", twoFactorEnabled: true });
    await prisma.session.createMany({
      data: [1, 2].map((i) => ({ id: `s${i}`, userId: rev.id, token: `t${i}`, expiresAt: new Date(Date.now() + 1e6) })),
    });
    await setStaffRole(a.id, rev.id, null);
    expect(await prisma.session.count({ where: { userId: rev.id } })).toBe(0);
    await rejects(assertStaff(rev.id), "FORBIDDEN", "Staff only.");
    expect((await listStaff(a.id)).map((s) => s.id)).toEqual([a.id]);
  });

  it("another admin can reset two-factor; it clears the secret, ends sessions and is logged", async () => {
    const a = await admin();
    const rev = await user("rev", { staffRole: "REVIEWER", twoFactorEnabled: true });
    await prisma.twoFactor.create({ data: { id: "tf1", userId: rev.id, secret: "s", backupCodes: "b" } });
    await prisma.session.create({ data: { id: "sx", userId: rev.id, token: "tx", expiresAt: new Date(Date.now() + 1e6) } });
    await resetTwoFactor(a.id, rev.id);
    expect(await prisma.twoFactor.count({ where: { userId: rev.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: rev.id } })).toBe(0);
    expect(await getStaffAccess(rev.id)).toEqual({ role: "REVIEWER", twoFactor: false });
    expect(await prisma.adminAction.count({ where: { action: "staff.reset_two_factor", targetId: rev.id } })).toBe(1);
  });

  it("you can't reset your own, a reviewer can't reset anyone's, and non-staff aren't resettable", async () => {
    const a = await admin();
    const rev = await user("rev", { staffRole: "REVIEWER", twoFactorEnabled: true });
    const member = await user("mem");
    await rejects(resetTwoFactor(a.id, a.id), "FORBIDDEN", /another admin/);
    await rejects(resetTwoFactor(rev.id, a.id), "FORBIDDEN", "Admins only.");
    await rejects(resetTwoFactor(a.id, member.id), "NOT_FOUND");
    expect((await getStaffAccess(a.id))?.twoFactor).toBe(true);
  });
});

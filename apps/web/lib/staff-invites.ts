import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertAdminOnly, logAdminAction, type StaffRole } from "./admin";
import { appUrl } from "./app-url";

// Inviting staff by email. English only. The token is random and only its SHA-256 is stored,
// so a database leak doesn't give working invite links. An invite is valid for 72 hours and
// works once.

export const INVITE_TTL_HOURS = 72;
export const INVITE_TTL_MS = INVITE_TTL_HOURS * 3600_000;
export const PASSWORD_MIN = 10;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Domains staff may be invited from: STAFF_EMAIL_DOMAINS, comma separated, e.g. "pin.org,example.org". */
export function staffDomains(): string[] {
  return (process.env.STAFF_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Exact domain match (so "evilpin.org" and "pin.org.evil.com" don't pass for "pin.org"). Fails closed when unset. */
export function isStaffEmailAllowed(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  return staffDomains().includes(email.slice(at + 1).trim().toLowerCase());
}

const normEmail = (e: string) => e.trim().toLowerCase();

export type InviteCreated = { id: string; email: string; role: StaffRole; url: string; expiresAt: Date };

/**
 * Create an invite. Earlier unused invites for the same address are cancelled, so only the
 * newest link works. Returns the link; the caller emails it (it is not stored anywhere).
 */
export async function inviteStaff(adminId: string, email: string, role: StaffRole): Promise<InviteCreated> {
  await assertAdminOnly(adminId);
  const to = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ServiceError("INVALID", "Enter a valid email address.");
  if (staffDomains().length === 0)
    throw new ServiceError("INVALID", "Staff invites are switched off: STAFF_EMAIL_DOMAINS is not set.");
  if (!isStaffEmailAllowed(to))
    throw new ServiceError("INVALID", `Staff must use one of these email domains: ${staffDomains().join(", ")}.`);
  if (role !== "ADMIN" && role !== "REVIEWER") throw new ServiceError("INVALID", "Choose a role.");

  const existing = await prisma.user.findUnique({ where: { email: to }, select: { staffRole: true, deletedAt: true } });
  if (existing?.deletedAt) throw new ServiceError("INVALID", "That account was deleted.");
  if (existing?.staffRole) throw new ServiceError("INVALID", "That person is already staff.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.staffInvite.updateMany({ where: { email: to, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const row = await tx.staffInvite.create({
      data: { email: to, role, tokenHash: hashToken(token), expiresAt, invitedById: adminId },
      select: { id: true },
    });
    await logAdminAction(tx, { actorId: adminId, action: "staff.invite", targetType: "StaffInvite", targetId: row.id, meta: { email: to, role } });
    return row;
  });
  return { id: invite.id, email: to, role, url: appUrl(`/accept-invite?token=${token}`), expiresAt };
}

export async function revokeInvite(adminId: string, inviteId: string) {
  await assertAdminOnly(adminId);
  await prisma.$transaction(async (tx) => {
    const done = await tx.staffInvite.updateMany({ where: { id: inviteId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (done.count === 0) throw new ServiceError("INVALID", "That invite is no longer open.");
    await logAdminAction(tx, { actorId: adminId, action: "staff.invite_revoke", targetType: "StaffInvite", targetId: inviteId });
  });
}

export type InviteState =
  | { ok: true; email: string; role: StaffRole }
  | { ok: false; reason: "invalid" | "used" | "expired" | "revoked" };

/** What the accept page shows for a token, without using it. */
export async function checkInvite(token: string): Promise<InviteState> {
  if (!token) return { ok: false, reason: "invalid" };
  const inv = await prisma.staffInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv) return { ok: false, reason: "invalid" };
  if (inv.usedAt) return { ok: false, reason: "used" };
  if (inv.revokedAt) return { ok: false, reason: "revoked" };
  if (inv.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  return { ok: true, email: inv.email, role: inv.role };
}

export const INVITE_ERRORS = {
  invalid: "This invite link isn't valid.",
  used: "This invite has already been used.",
  expired: "This invite has expired. Ask an admin to send a new one.",
  revoked: "This invite was cancelled. Ask an admin to send a new one.",
} as const;

type Hasher = (password: string) => Promise<string>;
const defaultHash: Hasher = async (pw) => (await (await import("./auth")).auth.$context).password.hash(pw);

/**
 * Accept an invite: the invitee chooses a name and password and the account takes the role.
 * The invite is claimed with one conditional update, so two clicks (or two tabs) can't both
 * use it. If the address already has an ordinary account it is promoted and its password is
 * left alone: they sign in as usual. Two-factor setup is forced at their first /admin visit.
 */
export async function acceptInvite(
  token: string,
  input: { firstName: string; lastName: string; password: string },
  hash: Hasher = defaultHash,
): Promise<{ email: string; promoted: boolean }> {
  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const state = await checkInvite(token);
  if (!state.ok) throw new ServiceError("INVALID", INVITE_ERRORS[state.reason]);
  if (!isStaffEmailAllowed(state.email)) throw new ServiceError("INVALID", "That email domain is no longer allowed for staff.");
  const existing = await prisma.user.findUnique({ where: { email: state.email }, select: { id: true, deletedAt: true, suspendedAt: true } });
  if (existing?.deletedAt || existing?.suspendedAt) throw new ServiceError("FORBIDDEN", "That account can't take a staff role.");
  if (!existing) {
    if (first.length < 2 || last.length < 2) throw new ServiceError("INVALID", "Enter your first and last name.");
    if (input.password.length < PASSWORD_MIN) throw new ServiceError("INVALID", `Use a password of at least ${PASSWORD_MIN} characters.`);
  }
  const passwordHash = existing ? null : await hash(input.password);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.staffInvite.updateMany({
      where: { tokenHash: hashToken(token), usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new ServiceError("INVALID", INVITE_ERRORS.used);
    const inv = await tx.staffInvite.findUniqueOrThrow({ where: { tokenHash: hashToken(token) }, include: { invitedBy: { select: { countryCode: true } } } });

    let userId: string;
    if (existing) {
      userId = existing.id;
      await tx.user.update({ where: { id: userId }, data: { staffRole: inv.role, emailVerified: true } });
    } else {
      // Staff accounts take the inviter's country; it only fills the required column.
      const u = await tx.user.create({
        data: {
          email: inv.email, emailVerified: true, firstName: first, lastName: last, name: `${first} ${last}`,
          countryCode: inv.invitedBy.countryCode, staffRole: inv.role, role: "GUEST",
        },
        select: { id: true },
      });
      userId = u.id;
      await tx.account.create({
        data: { id: `acc-${randomBytes(12).toString("hex")}`, accountId: userId, providerId: "credential", userId, password: passwordHash },
      });
    }
    await tx.staffInvite.update({ where: { id: inv.id }, data: { usedById: userId } });
    await logAdminAction(tx, { actorId: userId, action: "staff.accept_invite", targetType: "StaffInvite", targetId: inv.id, meta: { role: inv.role } });
    return { email: inv.email, promoted: !!existing };
  });
}

/** Invites that are still open, newest first, for the staff page. */
export async function listOpenInvites(adminId: string) {
  await assertAdminOnly(adminId);
  return prisma.staffInvite.findMany({
    where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedBy: { select: { name: true } } },
  });
}

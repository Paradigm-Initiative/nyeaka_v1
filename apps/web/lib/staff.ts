import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertAdminOnly, logAdminAction, type StaffRole } from "./admin";

// Changing who is staff. English only. The only code that writes User.staffRole (besides
// the first-admin script, scripts/create-first-admin.ts); no public route or sign-up
// field can set it (lib/auth.ts declares none).

export const LAST_ADMIN = "You can't remove or demote the last admin. Make someone else an admin first.";

/**
 * Give a person a staff role, or remove it (role = null). The last admin can't be demoted
 * or removed: the admin rows are locked inside the transaction, so two admins demoting
 * each other at once can't both succeed.
 */
export async function setStaffRole(adminId: string, userId: string, role: StaffRole | null) {
  await assertAdminOnly(adminId);
  await prisma.$transaction(async (tx) => {
    const admins = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "user" WHERE "staffRole" = 'ADMIN' FOR UPDATE`;
    const target = await tx.user.findUnique({ where: { id: userId }, select: { staffRole: true, deletedAt: true } });
    if (!target || target.deletedAt) throw new ServiceError("NOT_FOUND", "User not found.");
    if (target.staffRole === role) return;
    const losesAdmin = target.staffRole === "ADMIN" && role !== "ADMIN";
    if (losesAdmin && admins.length <= 1) throw new ServiceError("FORBIDDEN", LAST_ADMIN);
    await tx.user.update({ where: { id: userId }, data: { staffRole: role } });
    if (role === null) {
      await tx.session.deleteMany({ where: { userId } });
      // Their open cases go back to the queue now instead of staying locked until the claim lapses.
      await tx.idVerification.updateMany({ where: { claimedById: userId }, data: { claimedById: null, claimedAt: null } });
    }
    await logAdminAction(tx, {
      actorId: adminId, action: "staff.set_role", targetType: "User", targetId: userId,
      meta: { from: target.staffRole, to: role },
    });
  });
}

export type StaffMember = {
  id: string; name: string; email: string; staffRole: StaffRole; twoFactorEnabled: boolean; lastLogin: Date | null;
};

/** Everyone with a staff role, admins first. */
export async function listStaff(adminId: string): Promise<StaffMember[]> {
  await assertAdminOnly(adminId);
  const rows = await prisma.user.findMany({
    where: { staffRole: { not: null }, deletedAt: null },
    orderBy: [{ staffRole: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, staffRole: true, twoFactorEnabled: true, lastLogin: true },
  });
  return rows.map((r) => ({ ...r, staffRole: r.staffRole!, twoFactorEnabled: !!r.twoFactorEnabled }));
}

/**
 * Lockout recovery: another admin clears someone's two-factor (lost phone and backup codes).
 * Their sessions end, and at next sign-in they are held at the setup page until they enrol
 * again. You can't reset your own, so one person can't quietly drop their own second factor.
 */
export async function resetTwoFactor(adminId: string, userId: string) {
  await assertAdminOnly(adminId);
  if (userId === adminId) throw new ServiceError("FORBIDDEN", "Ask another admin to reset your two-factor.");
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { staffRole: true, deletedAt: true } });
    if (!target || target.deletedAt || !target.staffRole) throw new ServiceError("NOT_FOUND", "Staff member not found.");
    await tx.twoFactor.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
    await tx.session.deleteMany({ where: { userId } });
    await logAdminAction(tx, { actorId: adminId, action: "staff.reset_two_factor", targetType: "User", targetId: userId });
  });
}

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
    if (role === null) await tx.session.deleteMany({ where: { userId } });
    await logAdminAction(tx, {
      actorId: adminId, action: "staff.set_role", targetType: "User", targetId: userId,
      meta: { from: target.staffRole, to: role },
    });
  });
}

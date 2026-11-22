import { prisma } from "@/neon-db";
import type { Prisma } from "@/generated/prisma/client";
import { ServiceError } from "./errors";
import { getCountryConfig } from "./countries";
import { getEnabledCountryCodes, resetEnabledCountriesCache } from "./enabled-countries";

// Admin screens and services are English only for now (see CLAUDE.md), so these
// messages are plain English and are shown to the admin as they are.

export type StaffRole = "ADMIN" | "REVIEWER";

export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { staffRole: true, suspendedAt: true, deletedAt: true } });
  if (!u || u.suspendedAt || u.deletedAt) return null;
  return u.staffRole;
}

/** Throws unless the user is staff (admin or reviewer). For the ID queue and reports. */
export async function assertStaff(userId: string): Promise<StaffRole> {
  const role = await getStaffRole(userId);
  if (!role) throw new ServiceError("FORBIDDEN", "Staff only.");
  return role;
}

/** Throws unless the user is an admin. For countries, suspension, the log and staff management. */
export async function assertAdminOnly(userId: string): Promise<void> {
  if ((await getStaffRole(userId)) !== "ADMIN") throw new ServiceError("FORBIDDEN", "Admins only.");
}

export async function isStaff(userId: string): Promise<boolean> {
  return (await getStaffRole(userId)) !== null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getStaffRole(userId)) === "ADMIN";
}

/** Anything an admin does that should be traceable goes through here (same transaction as the change). */
export async function logAdminAction(
  tx: Pick<typeof prisma, "adminAction">,
  entry: { actorId: string; action: string; targetType: string; targetId?: string; reason?: string; meta?: Prisma.InputJsonValue },
) {
  await tx.adminAction.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      reason: entry.reason ?? null,
      meta: entry.meta,
    },
  });
}

/**
 * Switch a country on or off. Switching off stops new sign-ups there and stops its
 * people posting or sending offers; posts, chats and matches that exist stay visible.
 * At least one country must stay on, or nobody could sign up. Every real change is logged.
 */
export async function setCountryEnabled(adminId: string, code: string, enabled: boolean): Promise<string[]> {
  await assertAdminOnly(adminId);
  const cc = code.trim().toUpperCase();
  if (!getCountryConfig(cc)) throw new ServiceError("INVALID", `Unknown country: ${code}.`);

  await prisma.$transaction(async (tx) => {
    let changed: boolean;
    if (enabled) {
      changed = (await tx.enabledCountry.createMany({ data: [{ code: cc, enabledById: adminId }], skipDuplicates: true })).count > 0;
    } else {
      // One statement, so two admins switching off the last two countries can't both succeed.
      const removed = await tx.$executeRaw`
        DELETE FROM "EnabledCountry"
        WHERE "code" = ${cc} AND (SELECT count(*) FROM "EnabledCountry") > 1`;
      if (removed === 0 && (await tx.enabledCountry.findUnique({ where: { code: cc } })))
        throw new ServiceError("INVALID", "At least one country must stay enabled.");
      changed = removed > 0;
    }
    if (changed)
      await logAdminAction(tx, {
        actorId: adminId,
        action: enabled ? "country.enable" : "country.disable",
        targetType: "Country",
        targetId: cc,
      });
  });
  resetEnabledCountriesCache();
  return getEnabledCountryCodes();
}

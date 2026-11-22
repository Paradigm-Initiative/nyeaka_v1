import { prisma } from "@/neon-db";
import type { Prisma } from "@/generated/prisma/client";
import { ServiceError } from "./errors";
import { getCountryConfig } from "./countries";
import { getEnabledCountryCodes, resetEnabledCountriesCache } from "./enabled-countries";

// Admin screens and services are English only for now (see CLAUDE.md), so these
// messages are plain English and are shown to the admin as they are.

export type StaffRole = "ADMIN" | "REVIEWER";

async function loadStaff(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffRole: true, twoFactorEnabled: true, suspendedAt: true, deletedAt: true },
  });
  if (!u || u.suspendedAt || u.deletedAt) return null;
  return u;
}

/** The person's staff role, whether or not they have set up two-factor yet. */
export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  return (await loadStaff(userId))?.staffRole ?? null;
}

/** Role plus whether two-factor is on. The layout uses it to send staff to enrolment. */
export async function getStaffAccess(userId: string): Promise<{ role: StaffRole; twoFactor: boolean } | null> {
  const u = await loadStaff(userId);
  return u?.staffRole ? { role: u.staffRole, twoFactor: !!u.twoFactorEnabled } : null;
}

export const TWO_FACTOR_REQUIRED = "Set up two-factor sign-in before using the admin area.";

/** Staff role, and two-factor must be on: the same rule the layout applies, repeated in every action. */
async function requireStaff(userId: string): Promise<StaffRole> {
  const a = await getStaffAccess(userId);
  if (!a) throw new ServiceError("FORBIDDEN", "Staff only.");
  if (!a.twoFactor) throw new ServiceError("FORBIDDEN", TWO_FACTOR_REQUIRED);
  return a.role;
}

/** Throws unless the user is staff (admin or reviewer) with two-factor on. For the ID queue and reports. */
export async function assertStaff(userId: string): Promise<StaffRole> {
  return requireStaff(userId);
}

/** Throws unless the user is an admin with two-factor on. For countries, suspension, the log and staff management. */
export async function assertAdminOnly(userId: string): Promise<void> {
  const a = await getStaffAccess(userId);
  if (a?.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Admins only.");
  if (!a.twoFactor) throw new ServiceError("FORBIDDEN", TWO_FACTOR_REQUIRED);
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

import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { getCountryConfig } from "./countries";
import { getEnabledCountryCodes, resetEnabledCountriesCache } from "./enabled-countries";

// Admin screens and services are English only for now (see CLAUDE.md), so these
// messages are plain English and are shown to the admin as they are.

/** Throws unless the user is an admin. Call at the top of every admin action. */
export async function assertAdmin(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role !== "ADMIN") throw new ServiceError("FORBIDDEN", "Admins only.");
}

export async function isAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "ADMIN";
}

/**
 * Switch a country on or off. Switching off stops new sign-ups there and stops its
 * people posting or sending offers; posts, chats and matches that exist stay visible.
 * At least one country must stay on, or nobody could sign up.
 */
export async function setCountryEnabled(adminId: string, code: string, enabled: boolean): Promise<string[]> {
  await assertAdmin(adminId);
  const cc = code.trim().toUpperCase();
  if (!getCountryConfig(cc)) throw new ServiceError("INVALID", `Unknown country: ${code}.`);

  if (enabled) {
    await prisma.enabledCountry.upsert({ where: { code: cc }, update: {}, create: { code: cc, enabledById: adminId } });
  } else {
    // One statement, so two admins switching off the last two countries can't both succeed.
    const removed = await prisma.$executeRaw`
      DELETE FROM "EnabledCountry"
      WHERE "code" = ${cc} AND (SELECT count(*) FROM "EnabledCountry") > 1`;
    if (removed === 0 && (await prisma.enabledCountry.findUnique({ where: { code: cc } })))
      throw new ServiceError("INVALID", "At least one country must stay enabled.");
  }
  resetEnabledCountriesCache();
  return getEnabledCountryCodes();
}

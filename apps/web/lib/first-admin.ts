import { prisma } from "@/neon-db";
import { appUrl } from "./app-url";
import { getCountryConfig } from "./countries";

export type FirstAdminResult =
  | { created: true; email: string; promoted: boolean }
  | { created: false; reason: "admin-exists" | "no-email" | "bad-country" };

type Deps = { sendSetPasswordLink?: (email: string) => Promise<void> };

const defaultSend = async (email: string) => {
  const { auth } = await import("./auth"); // lazy: keeps this module light for tests and scripts
  await auth.api.requestPasswordReset({ body: { email, redirectTo: appUrl("/reset-password") } });
};

/**
 * Make the first admin from SEED_ADMIN_EMAIL. Safe to run in production, and to run twice:
 * it does nothing once any admin exists. The person gets a set-password email (the normal
 * reset link; it is valid for an hour, after that "Forgot password" gives a new one).
 * Separate from prisma/seed.ts, which is dev-only. Never touches an account that isn't
 * the one named, and never overwrites an existing password.
 */
export async function createFirstAdmin(email: string | undefined, deps: Deps = {}): Promise<FirstAdminResult> {
  const to = email?.trim().toLowerCase();
  if (!to) return { created: false, reason: "no-email" };
  const country = (process.env.SEED_ADMIN_COUNTRY || "NG").trim().toUpperCase();
  if (!getCountryConfig(country)) return { created: false, reason: "bad-country" };

  const promoted = await prisma.$transaction(async (tx) => {
    // One run at a time, so two deploys starting together can't both create an admin.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7001)`;
    if ((await tx.user.count({ where: { staffRole: "ADMIN" } })) > 0) return null;
    const existing = await tx.user.findUnique({ where: { email: to }, select: { id: true } });
    if (existing) {
      await tx.user.update({ where: { id: existing.id }, data: { staffRole: "ADMIN", emailVerified: true } });
      return true;
    }
    const local = to.split("@")[0] || "Admin";
    await tx.user.create({
      data: {
        email: to, emailVerified: true, firstName: local, lastName: "Admin", name: `${local} Admin`,
        countryCode: country, staffRole: "ADMIN", role: "GUEST",
      },
    });
    return false;
  });
  if (promoted === null) return { created: false, reason: "admin-exists" };

  await (deps.sendSetPasswordLink ?? defaultSend)(to);
  return { created: true, email: to, promoted };
}

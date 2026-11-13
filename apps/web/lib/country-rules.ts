import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { isEnabledCountry } from "./enabled-countries";
import { isLocale, defaultLocale, type Locale } from "@/i18n/config";

// Both are mapped to translation keys in lib/error-keys.ts.
export const COUNTRY_UNAVAILABLE = "Nyeaka isn't available in your country yet, so you can't post or send offers.";
export const DIFFERENT_COUNTRY = "Offers are only possible between people in the same country.";

/**
 * The country a person posts from: always their own account's country, never a
 * value they type. Refuses when that country isn't switched on (yet, or any more).
 */
export async function requirePostingCountry(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
  if (!u || !(await isEnabledCountry(u.countryCode))) throw new ServiceError("INVALID", COUNTRY_UNAVAILABLE);
  return u.countryCode;
}

/** Handoff is in person, so listings and requests only pair up within one country (v1). */
export function assertSameCountry(a: string, b: string): void {
  if (a !== b) throw new ServiceError("INVALID", DIFFERENT_COUNTRY);
}

/** What a new account is stored with. Country must be enabled; an unknown language falls back to English. */
export async function prepareNewUser(input: Record<string, unknown>): Promise<
  | { ok: true; countryCode: string; locale: Locale }
  | { ok: false; code: "COUNTRY_NOT_AVAILABLE" }
> {
  const countryCode = typeof input.countryCode === "string" ? input.countryCode.trim().toUpperCase() : "";
  if (!(await isEnabledCountry(countryCode))) return { ok: false, code: "COUNTRY_NOT_AVAILABLE" };
  return { ok: true, countryCode, locale: isLocale(input.locale) ? input.locale : defaultLocale };
}

import { prisma } from "@/neon-db";

/**
 * The countries an admin has switched on (table EnabledCountry).
 *
 * Read on sign-up, on every post and on every offer, so the list is kept in memory
 * for a minute per server instance. An admin change is visible at once on the
 * instance that made it and within a minute everywhere else. Tests skip the cache.
 */
const TTL_MS = 60_000;
let cached: { codes: string[]; at: number } | null = null;

export async function getEnabledCountryCodes(): Promise<string[]> {
  const useCache = process.env.NODE_ENV !== "test";
  if (useCache && cached && Date.now() - cached.at < TTL_MS) return cached.codes;
  const rows = await prisma.enabledCountry.findMany({ select: { code: true }, orderBy: { code: "asc" } });
  const codes = rows.map((r) => r.code);
  if (useCache) cached = { codes, at: Date.now() };
  return codes;
}

export async function isEnabledCountry(code?: string | null): Promise<boolean> {
  if (!code) return false;
  return (await getEnabledCountryCodes()).includes(code.trim().toUpperCase());
}

/** Forget the cached list (called after an admin changes it). */
export function resetEnabledCountriesCache(): void {
  cached = null;
}

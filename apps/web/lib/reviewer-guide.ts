/**
 * Link to the reviewer guide, from REVIEWER_GUIDE_URL. Optional: with no value there is no link.
 * "{country}" in the value is replaced by the case's country code (for example NG), so one
 * variable can point at a per-country page: https://docs.example.org/id-guide/{country}
 * Only http(s) links are used.
 */
export function reviewerGuideUrl(countryCode: string, raw = process.env.REVIEWER_GUIDE_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const url = value.replaceAll("{country}", encodeURIComponent(countryCode.toUpperCase()));
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

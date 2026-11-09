/**
 * Only allow same-site relative paths. Rejects absolute URLs, protocol-relative
 * URLs ("//evil.com") and backslash tricks, which would be open redirects.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}

/**
 * Absolute URL for links in emails. Uses the configured site address
 * (BETTER_AUTH_URL, then NEXT_PUBLIC_BETTER_AUTH_URL) and falls back to localhost.
 */
export function appUrl(path: string): string {
  const base =
    process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

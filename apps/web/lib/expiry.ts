export const POST_LIFETIME_DAYS = 60;

export function defaultExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + POST_LIFETIME_DAYS);
  return d;
}

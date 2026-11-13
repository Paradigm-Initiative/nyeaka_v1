// Admin screens are English only; dates are shown in UTC so they read the same for every admin.
const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
export const adminDate = (d: Date) => `${fmt.format(d)} UTC`;

/** "3 days", "5 hours", "12 minutes": how long ago, for queue ages. */
export function ageOf(d: Date, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - d.getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / 1440)} d`;
}

export const DOC_LABEL: Record<string, string> = {
  NATIONAL_ID: "National ID",
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver's licence",
  VOTERS_CARD: "Voter's card",
  RESIDENCE_PERMIT: "Residence permit",
};

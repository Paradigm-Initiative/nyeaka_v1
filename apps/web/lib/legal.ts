// The legal pages' text lives in messages/*.json under `legal`; this is the order of their sections.
export const PRIVACY_SECTIONS = ["who", "collect", "why", "documents", "sharing", "retention", "rights", "children", "changes"] as const;
export const TERMS_SECTIONS = ["accept", "account", "posts", "handoff", "conduct", "role", "suspension", "changes"] as const;

/** When the legal pages were last changed. Update it whenever their text changes. */
export const LEGAL_UPDATED = new Date("2026-11-13T00:00:00Z");

/**
 * The version recorded when someone accepts the terms and privacy policy. Change it when
 * their text changes in a way people must agree to again (not for typo fixes).
 */
export const LEGAL_VERSION = "2026-11-13";

/**
 * What sign-up stores. The form sends the version of the text the person ticked the box
 * next to; it counts only if it is the current one, so a missing box, a forged value or a
 * page left open across a change of the text all stop sign-up (null).
 */
export function termsAcceptance(acceptedVersion: unknown, now = new Date()) {
  return acceptedVersion === LEGAL_VERSION ? { termsAcceptedAt: now, termsVersion: LEGAL_VERSION } : null;
}

/** Where people can write to us. Unset means the contact page says it is being set up. */
export const contactEmail = () => process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || null;

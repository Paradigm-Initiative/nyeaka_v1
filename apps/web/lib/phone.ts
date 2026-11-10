import { ServiceError } from "./errors";

/**
 * Normalise a phone number the user typed: drop spaces, dashes, dots and
 * brackets, keep a leading "+". Accepts 7 to 15 digits (the E.164 maximum).
 * No country is guessed: the number is stored as written so it still works when
 * the other person dials it.
 */
export function normalizePhone(input: string): string {
  const cleaned = input.trim().replace(/[\s\-.()]/g, "");
  if (!/^\+?\d{7,15}$/.test(cleaned))
    throw new ServiceError("INVALID", "Enter a valid phone number, for example +234 806 412 0088.");
  return cleaned;
}

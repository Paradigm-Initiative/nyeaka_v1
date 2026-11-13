import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { ServiceError } from "./errors";

/** Mapped to a translation key in lib/error-keys.ts. */
export const INVALID_PHONE = "Enter a valid phone number, including the country code.";

/**
 * Validate a typed phone number and return it as E.164 ("+2348064120088").
 *
 * libphonenumber knows every country's dialling code, numbering plan and trunk
 * prefix, so nothing is configured per country here. A number written with "+" or
 * "00" is checked as its own country's number; a local one ("0806 412 0088") is
 * read as a number in `country` (the account's country). It must be a real number
 * for that country, not just 7 to 15 digits.
 */
export function normalizePhone(input: string, country?: string | null): string {
  const text = input.trim().replace(/^00/, "+");
  // Digits and the usual separators only. libphonenumber would quietly accept (and drop) a trailing "ext 5".
  if (!/^\+?[\d\s().-]+$/.test(text)) throw new ServiceError("INVALID", INVALID_PHONE);
  const parsed = parsePhoneNumberFromString(text, (country?.toUpperCase() as CountryCode | undefined) || undefined);
  if (!parsed?.isValid()) throw new ServiceError("INVALID", INVALID_PHONE);
  return parsed.number;
}

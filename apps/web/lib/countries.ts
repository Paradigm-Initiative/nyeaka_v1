/**
 * Which countries exist and their defaults. Nyeaka is Africa-wide by design, but a
 * country is only usable once an admin has enabled it: that list lives in the
 * database (EnabledCountry, see lib/enabled-countries.ts), not here.
 * Names are NOT stored: they come from Intl.DisplayNames in the user's language.
 */

export type IdDocType =
  | "NATIONAL_ID"
  | "PASSPORT"
  | "DRIVERS_LICENSE"
  | "VOTERS_CARD"
  | "RESIDENCE_PERMIT";

export type CountryConfig = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** Documents we accept for manual ID review. Passport is accepted everywhere. */
  idDocTypes: IdDocType[];
  /** Format check for a typed ID number, only where a reliable one exists. */
  idNumber?: { docType: IdDocType; pattern: RegExp };
  /** For the admin reviewer (English only for now). */
  reviewerChecklist: string[];
};

const GENERIC_CHECKLIST = [
  "The document type matches what the user selected.",
  "The name on the ID matches the account name.",
  "The ID is not expired and the photo and text are clear.",
  "The selfie shows the same person as the ID photo.",
  "No signs of editing, and it is not a photo of a screen or a photocopy.",
];

const DEFAULT_DOCS: IdDocType[] = ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE"];

// Phone numbers need no per-country data: libphonenumber-js knows every country's
// dialling code and numbering plan (see lib/phone.ts). Example cities live in messages/*.json.
const AFRICA =
  "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW".split(
    " ",
  );

/** Optional per-country extras (accepted documents, ID-number format, checklist). Never required to enable a country. */
const OVERRIDES: Record<string, Partial<CountryConfig>> = {
  NG: {
    idDocTypes: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD"],
    idNumber: { docType: "NATIONAL_ID", pattern: /^\d{11}$/ }, // NIN
    reviewerChecklist: [
      ...GENERIC_CHECKLIST,
      "National ID: a NIMC card or NIN slip. If a NIN was typed, it is 11 digits.",
      "Voter's card: a permanent voter's card (PVC), not a temporary slip.",
    ],
  },
};

export const COUNTRY_CONFIG: CountryConfig[] = AFRICA.map((code) => ({
  code,
  idDocTypes: DEFAULT_DOCS,
  reviewerChecklist: GENERIC_CHECKLIST,
  ...OVERRIDES[code],
}));

const BY_CODE = new Map(COUNTRY_CONFIG.map((c) => [c.code, c]));

export const getCountryConfig = (code?: string | null): CountryConfig | undefined =>
  code ? BY_CODE.get(code.toUpperCase()) : undefined;

/** Is this a country Nyeaka knows about (enabled or not)? */
export const isKnownCountry = (code?: string | null): boolean => !!getCountryConfig(code);


export type CountryOption = { code: string; name: string };

/**
 * Country names in the given language, sorted for that language.
 * `only` limits the list to those codes (pass the enabled ones); `include` keeps one
 * extra code in it (e.g. an existing post's country, even if since disabled).
 */
export function getCountries(
  locale: string,
  opts: { only?: readonly string[]; include?: string | null } = {},
): CountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const include = opts.include?.toUpperCase();
  return COUNTRY_CONFIG.filter((c) => !opts.only || opts.only.includes(c.code) || c.code === include)
    .map((c) => ({ code: c.code, name: names.of(c.code) ?? c.code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Works for any ISO code, including legacy rows outside the config. */
export const countryName = (code: string, locale: string) =>
  new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;


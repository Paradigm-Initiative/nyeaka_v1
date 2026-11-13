import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

const catalogues = { en, fr, pt } satisfies Record<Locale, unknown>;

/** The locale an email is written in: the recipient's saved language, English if unknown. */
export const emailLocale = (value?: unknown): Locale => (isLocale(value) ? value : defaultLocale);

/**
 * Translator for the `emails` namespace. Emails are built outside a request (and in
 * tests), so this uses next-intl's framework-free translator with the catalogues
 * imported directly. `html` fills `<strong>` tags; callers escape every value first.
 */
export function emailTranslator(value?: unknown) {
  const locale = emailLocale(value);
  const t = createTranslator({ locale, messages: catalogues[locale], namespace: "emails" });
  const html = (key: string, values: Record<string, string>) =>
    t.markup(key as never, { ...values, strong: (c: string) => `<strong>${c}</strong>` } as never) as string;
  return { locale, t: t as unknown as (key: string, values?: Record<string, string>) => string, html };
}

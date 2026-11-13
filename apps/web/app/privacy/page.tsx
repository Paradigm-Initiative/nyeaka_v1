import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import LegalDocument from "@/components/legal/legal-document";
import { LEGAL_UPDATED, PRIVACY_SECTIONS } from "@/lib/legal";
import { countryName } from "@/lib/countries";
import { getEnabledCountryCodes } from "@/lib/enabled-countries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: `${t("title")} - Nyeaka` };
}

export default async function PrivacyPage() {
  const [t, tl, format, locale, enabled] = await Promise.all([
    getTranslations("legal.privacy"),
    getTranslations("legal"),
    getFormatter(),
    getLocale(),
    getEnabledCountryCodes(),
  ]);
  // Only countries Nyeaka is switched on in, and only those we have text for.
  const countries = enabled.filter((c) => t.has(`countries.${c}.law`)).sort();

  return (
    <LegalDocument
      title={t("title")}
      intro={t("intro")}
      updated={tl("updated", { date: format.dateTime(LEGAL_UPDATED, { dateStyle: "long" }) })}
      sections={PRIVACY_SECTIONS.map((id) => ({ id, title: t(`sections.${id}.title`), body: t(`sections.${id}.body`) }))}
    >
      {countries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading-4">{t("countriesTitle")}</h2>
          <p className="text-body-md">{t("countriesIntro")}</p>
          <ul className="flex flex-col gap-2 pl-5 list-disc">
            {countries.map((c) => (
              <li key={c} className="text-body-md">
                {t("countryLine", { country: countryName(c, locale), law: t(`countries.${c}.law`), regulator: t(`countries.${c}.regulator`) })}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-body-sm">
        <Link href="/contact" className="text-link hover:underline">{tl("contactLink")}</Link>
      </p>
    </LegalDocument>
  );
}

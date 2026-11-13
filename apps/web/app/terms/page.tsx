import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import LegalDocument from "@/components/legal/legal-document";
import { LEGAL_UPDATED, TERMS_SECTIONS } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: `${t("title")} - Nyeaka` };
}

export default async function TermsPage() {
  const [t, tl, format] = await Promise.all([getTranslations("legal.terms"), getTranslations("legal"), getFormatter()]);
  return (
    <LegalDocument
      title={t("title")}
      intro={t("intro")}
      updated={tl("updated", { date: format.dateTime(LEGAL_UPDATED, { dateStyle: "long" }) })}
      sections={TERMS_SECTIONS.map((id) => ({ id, title: t(`sections.${id}.title`), body: t(`sections.${id}.body`) }))}
    >
      <p className="text-body-sm">
        <Link href="/contact" className="text-link hover:underline">{tl("contactLink")}</Link>
      </p>
    </LegalDocument>
  );
}

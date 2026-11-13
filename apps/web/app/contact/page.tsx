import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { contactEmail } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contact");
  return { title: `${t("title")} - Nyeaka` };
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");
  const email = contactEmail();
  return (
    <div className="flex flex-col gap-4 mx-auto py-8 max-w-2xl section-wrapper">
      <h1 className="text-heading-2">{t("title")}</h1>
      <p className="text-body-lg text-pretty">{t("intro")}</p>
      <p className="text-body-md">
        {email ? (
          <>
            {t("emailLabel")}{" "}
            <a href={`mailto:${email}`} className="text-link hover:underline">{email}</a>
          </>
        ) : (
          t("noEmail")
        )}
      </p>
      <p className="text-muted-foreground text-body-sm">{t("safety")}</p>
    </div>
  );
}

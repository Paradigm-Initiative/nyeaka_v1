import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/neon-db";
import { getServerSession } from "@/lib/get-session";
import { countryName } from "@/lib/countries";
import DeleteAccount from "@/components/settings/delete-account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("title")} - Nyeaka` };
}

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/settings");
  const [t, locale, user] = await Promise.all([
    getTranslations("settings"),
    getLocale(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, name: true, countryCode: true, role: true } }),
  ]);
  if (!user) redirect("/sign-in?callbackUrl=/settings");

  return (
    <div className="flex flex-col gap-6 mx-auto py-8 max-w-2xl section-wrapper">
      <h1 className="text-heading-2">{t("title")}</h1>
      <dl className="gap-x-6 gap-y-2 grid grid-cols-[max-content_1fr] text-body-sm">
        <dt className="text-muted-foreground">{t("name")}</dt><dd>{user.name}</dd>
        <dt className="text-muted-foreground">{t("email")}</dt><dd>{user.email}</dd>
        <dt className="text-muted-foreground">{t("country")}</dt><dd>{countryName(user.countryCode, locale)}</dd>
      </dl>
      <p className="text-body-sm">
        <Link href="/privacy" className="text-link hover:underline">{t("privacyLink")}</Link>
      </p>

      <section className="flex flex-col gap-3 pt-6 border-t">
        <h2 className="text-heading-4">{t("deleteTitle")}</h2>
        <p className="text-muted-foreground text-body-sm">{t("deleteBody")}</p>
        {user.role === "ADMIN" ? (
          <p className="text-body-sm">{t("deleteAdmin")}</p>
        ) : (
          <DeleteAccount email={user.email} />
        )}
      </section>
    </div>
  );
}

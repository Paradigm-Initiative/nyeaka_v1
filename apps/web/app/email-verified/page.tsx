import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/get-session";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("emailVerified")} - Nyeaka` };
}

export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth.emailVerified");
  const { error } = await searchParams;
  const session = await getServerSession();

  if (error) {
    return (
      <div className="flex flex-1 justify-center items-center py-16 text-center section-wrapper">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-heading-2">{t("invalidTitle")}</h1>
          <p className="max-w-[48ch] text-muted-foreground text-body-lg">
            {t("invalidBody")}
          </p>
          <Button asChild>
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center items-center py-16 text-center section-wrapper">
      <div className="flex flex-col items-center gap-4">
        <div className="flex justify-center items-center bg-surface-feature border-2 border-pin-green-600 rounded-lg size-14">
          <div className="border-2 border-pin-green-600 rounded-xs w-6.5 h-4.5" />
        </div>
        <h1 className="text-heading-2">
          {session ? t("verifiedNamed", { name: session.user.name.split(" ")[0] }) : t("verified")}
        </h1>
        <p className="max-w-[48ch] text-muted-foreground text-body-lg">
          {t("body")}
        </p>
        <Button asChild>
          <Link href={session ? "/dashboard" : "/sign-in"}>
            {session ? t("dashboard") : t("signIn")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

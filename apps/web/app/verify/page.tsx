import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/neon-db";
import { getServerSession } from "@/lib/get-session";
import { countryName, getCountryConfig } from "@/lib/countries";
import VerifyForm from "@/components/verify/verify-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("verify")} - Nyeaka` };
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/verify");

  const [{ for: purpose }, locale, user] = await Promise.all([
    searchParams,
    getLocale(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        countryCode: true,
        idVerificationStatus: true,
        name: true,
        idVerifications: { orderBy: { createdAt: "desc" }, take: 1, select: { rejectionCode: true, rejectionReason: true } },
      },
    }),
  ]);
  if (!user) redirect("/sign-in?callbackUrl=/verify");

  const config = getCountryConfig(user.countryCode);

  return (
    <div className="section-wrapper">
      <VerifyForm
        purpose={purpose === "list" ? "list" : "request"}
        status={user.idVerificationStatus}
        countryName={countryName(user.countryCode, locale)}
        docTypes={config?.idDocTypes ?? ["PASSPORT"]}
        defaultName={user.name}
        rejectionCode={user.idVerificationStatus === "FAILED" ? (user.idVerifications[0]?.rejectionCode ?? null) : null}
        rejectionReason={
          // The reviewer's note is internal. Only rows from before presets existed, and the purge
          // job's "not reviewed in time" text, have no code and show their own text.
          user.idVerificationStatus === "FAILED" && !user.idVerifications[0]?.rejectionCode
            ? (user.idVerifications[0]?.rejectionReason ?? null)
            : null
        }
      />
    </div>
  );
}

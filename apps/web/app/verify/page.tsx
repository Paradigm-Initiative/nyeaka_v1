import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import VerifyForm from "@/components/verify/verify-form";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("verify")} - Nyeaka` };
}

export default async function VerifyPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/verify");

  return (
    <div className="section-wrapper">
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}

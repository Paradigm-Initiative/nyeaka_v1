import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailNotice } from "./verify-email-notice";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("verifyEmail")} - Nyeaka` };
}

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <Suspense fallback={null}>
          <VerifyEmailNotice />
        </Suspense>
      </div>
    </div>
  );
}

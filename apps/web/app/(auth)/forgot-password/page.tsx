import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("forgotPassword")} - Nyeaka` };
}

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getServerSession } from "@/lib/get-session";
import { getUserProfile } from "@/lib/queries";
import { getCountries } from "@/lib/countries";
import PostRequestForm from "@/components/post/post-request-form";
import SignInRequired from "@/components/auth/sign-in-required";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("newRequest")} - Nyeaka` };
}

export default async function NewRequestPage() {
  const t = await getTranslations("signInRequired");
  const session = await getServerSession();

  if (!session) {
    return (
      <SignInRequired
        title={t("newRequest.title")}
        description={t("newRequest.description")}
        callbackUrl="/requests/new"
      />
    );
  }

  const profile = await getUserProfile(session.user.id);

  return (
    <div className="section-wrapper">
      <PostRequestForm defaultCountry={profile?.countryCode ?? ""} countries={getCountries(await getLocale())} />
    </div>
  );
}

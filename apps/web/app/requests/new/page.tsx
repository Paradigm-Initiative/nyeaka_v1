import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getUserProfile } from "@/lib/queries";
import PostRequestForm from "@/components/post/post-request-form";
import SignInRequired from "@/components/auth/sign-in-required";
import { getTranslations } from "next-intl/server";

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
  if (profile?.idVerificationStatus !== "VERIFIED") redirect("/verify?for=request");

  return (
    <div className="section-wrapper">
      <PostRequestForm country={profile?.countryCode ?? ""} />
    </div>
  );
}

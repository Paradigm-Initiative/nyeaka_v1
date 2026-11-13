import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getUserProfile } from "@/lib/queries";
import PostListingForm from "@/components/post/post-listing-form";
import SignInRequired from "@/components/auth/sign-in-required";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("newListing")} - Nyeaka` };
}

export default async function NewListingPage() {
  const t = await getTranslations("signInRequired");
  const session = await getServerSession();

  if (!session) {
    return (
      <SignInRequired
        title={t("newListing.title")}
        description={t("newListing.description")}
        callbackUrl="/listings/new"
      />
    );
  }

  const profile = await getUserProfile(session.user.id);
  if (profile?.idVerificationStatus !== "VERIFIED") redirect("/verify?for=list");

  return (
    <div className="section-wrapper">
      <PostListingForm country={profile?.countryCode ?? ""} />
    </div>
  );
}

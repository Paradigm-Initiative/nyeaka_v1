import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getListingForEdit } from "@/lib/queries";
import { postState } from "@/lib/lifecycle";
import PostListingForm from "@/components/post/post-listing-form";
import SignInRequired from "@/components/auth/sign-in-required";
import RenewPrompt from "@/components/post/renew-prompt";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("editListing")} - Nyeaka` };
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listing: string }>;
}) {
  const { listing: id } = await params;
  const t = await getTranslations("signInRequired");
  const session = await getServerSession();
  if (!session) {
    return (
      <SignInRequired
        title={t("editListing.title")}
        description={t("editListing.description")}
        callbackUrl={`/listings/${id}/edit`}
      />
    );
  }

  const l = await getListingForEdit(id);
  if (!l || l.donorId !== session.user.id) notFound(); // don't reveal other people's posts

  const state = postState(l.status, l.expiresAt);
  if (state !== "ACTIVE") {
    return <RenewPrompt kind="listing" id={id} title={l.title} state={state} />;
  }

  return (
    <div className="section-wrapper">
      <PostListingForm
        country={l.countryCode}
        editing={{
          id,
          values: {
            deviceType: l.deviceType,
            brand: l.brand,
            model: l.model,
            condition: l.condition,
            description: l.description,
            city: l.city,
            area: l.area ?? "",
            photos: l.photos,
            hasCharger: l.spec?.hasCharger ?? false,
            hasKeyboard: l.spec?.hasKeyboard ?? false,
          },
        }}
      />
    </div>
  );
}

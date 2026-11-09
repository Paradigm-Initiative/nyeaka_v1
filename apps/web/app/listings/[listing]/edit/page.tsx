import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getListingForEdit } from "@/lib/queries";
import { COUNTRIES } from "@/lib/countries";
import { postState } from "@/lib/lifecycle";
import PostListingForm from "@/components/post/post-listing-form";
import SignInRequired from "@/components/auth/sign-in-required";
import RenewPrompt from "@/components/post/renew-prompt";

export const metadata: Metadata = { title: "Edit listing - Nyeaka" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listing: string }>;
}) {
  const { listing: id } = await params;
  const session = await getServerSession();
  if (!session) {
    return (
      <SignInRequired
        title="Sign in to edit your listing"
        description="Only the person who listed a device can change it."
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
        countries={COUNTRIES}
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
            countryCode: l.countryCode,
            photos: l.photos,
            hasCharger: l.spec?.hasCharger ?? false,
            hasKeyboard: l.spec?.hasKeyboard ?? false,
          },
        }}
      />
    </div>
  );
}

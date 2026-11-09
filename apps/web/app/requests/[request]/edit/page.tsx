import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getRequestForEdit } from "@/lib/queries";
import { COUNTRIES } from "@/lib/countries";
import { postState } from "@/lib/lifecycle";
import PostRequestForm from "@/components/post/post-request-form";
import SignInRequired from "@/components/auth/sign-in-required";
import RenewPrompt from "@/components/post/renew-prompt";

export const metadata: Metadata = { title: "Edit request - Nyeaka" };

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ request: string }>;
}) {
  const { request: id } = await params;
  const session = await getServerSession();
  if (!session) {
    return (
      <SignInRequired
        title="Sign in to edit your request"
        description="Only the person who posted a request can change it."
        callbackUrl={`/requests/${id}/edit`}
      />
    );
  }

  const r = await getRequestForEdit(id);
  if (!r || r.requesterId !== session.user.id) notFound();

  const state = postState(r.status, r.expiresAt);
  if (state !== "ACTIVE") {
    return <RenewPrompt kind="request" id={id} title={r.title} state={state} />;
  }

  return (
    <div className="section-wrapper">
      <PostRequestForm
        countries={COUNTRIES}
        editing={{
          id,
          values: {
            deviceType: r.deviceType ?? "OTHER",
            minCondition: r.minCondition ?? undefined,
            title: r.title,
            description: r.description,
            preferredBrand: r.preferredBrand ?? undefined,
            isUrgent: r.isUrgent,
            city: r.city,
            area: r.area ?? "",
            countryCode: r.countryCode,
            pledge: true,
          },
        }}
      />
    </div>
  );
}

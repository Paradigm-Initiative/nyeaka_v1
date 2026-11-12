import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getRequestForEdit } from "@/lib/queries";
import { getCountries } from "@/lib/countries";
import { postState } from "@/lib/lifecycle";
import PostRequestForm from "@/components/post/post-request-form";
import SignInRequired from "@/components/auth/sign-in-required";
import RenewPrompt from "@/components/post/renew-prompt";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("editRequest")} - Nyeaka` };
}

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ request: string }>;
}) {
  const { request: id } = await params;
  const t = await getTranslations("signInRequired");
  const session = await getServerSession();
  if (!session) {
    return (
      <SignInRequired
        title={t("editRequest.title")}
        description={t("editRequest.description")}
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
        countries={getCountries(await getLocale())}
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

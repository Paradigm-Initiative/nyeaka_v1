import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import OwnerPanel from "@/components/detail/owner-panel";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { getRequestDetail } from "@/lib/queries";
import { getRequestOfferContext } from "@/lib/offer-queries";
import { sharesMatch } from "@/lib/safety";
import ReportPanel from "@/components/safety/report-panel";
import { placeLabel } from "@/lib/format";
import { getFormatter, getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ request: string }>;
}): Promise<Metadata> {
  const { request } = await params;
  const session = await getServerSession();
  const data = await getRequestDetail(request, session?.user.id);
  const t = await getTranslations("titles");
  return { title: `${data ? data.request.title : t("request")} - Nyeaka` };
}

const RequestDetailPage = async ({
  params,
}: {
  params: Promise<{ request: string }>;
}) => {
  const { request: id } = await params;
  const t = await getTranslations("detail");
  const tDevice = await getTranslations("device");
  const format = await getFormatter();
  const session = await getServerSession();
  const data = await getRequestDetail(id, session?.user.id);
  if (!data) notFound();
  const { request: item, reputation, isOwner, state } = data;
  const kind = item.deviceType ?? "OTHER";
  const viewerId = session?.user.id;
  const context =
    viewerId && !isOwner && state === "ACTIVE"
      ? await getRequestOfferContext(viewerId, item.id)
      : null;
  const canReport = !!viewerId && !isOwner && (await sharesMatch(viewerId, item.requester.id));

  return (
    <DetailLayout
      kind={kind}
      eyebrow={`${item.minCondition ? tDevice(`condition.${item.minCondition}`) : t("anyCondition")} · ${tDevice(`kind.${kind}`)}`}
      title={item.title}
      place={placeLabel(item.city, item.area)}
      posted={format.relativeTime(item.createdAt)}
      note={item.description}
      specs={[
        { label: t("deviceNeeded"), value: tDevice(`kind.${kind}`) },
        { label: t("lowestCondition"), value: item.minCondition ? tDevice(`condition.${item.minCondition}`) : t("any") },
        { label: t("pledge"), value: t("pledgeValue") },
      ]}
      who={item.requester.firstName}
      rating={reputation.rating}
      handoffs={reputation.handoffs}
      backHref="/requests"
      backLabel={t("backToRequests")}
    >
      {isOwner ? (
        <OwnerPanel kind="request" id={item.id} state={state} expiresAt={item.expiresAt} />
      ) : (
        <ContactForm
          mode="offer"
          who={item.requester.firstName}
          signedIn={!!viewerId}
          targetId={item.id}
          context={context}
          closedMessage={state === "ACTIVE" ? undefined : t("requestClosed")}
        />
      )}
      {canReport && (
        <ReportPanel targetType="REQUEST" targetId={item.id} who={t("whoseRequest", { name: item.requester.firstName })} label={t("reportRequest")} />
      )}
    </DetailLayout>
  );
};

export default RequestDetailPage;

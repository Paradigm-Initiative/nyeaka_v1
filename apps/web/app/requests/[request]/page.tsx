import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import OwnerPanel from "@/components/detail/owner-panel";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { getRequestDetail } from "@/lib/queries";
import { getRequestOfferContext } from "@/lib/offer-queries";
import { conditionLabel, kindLabel } from "@/lib/device-options";
import { placeLabel, timeAgo } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ request: string }>;
}): Promise<Metadata> {
  const { request } = await params;
  const session = await getServerSession();
  const data = await getRequestDetail(request, session?.user.id);
  return { title: data ? `${data.request.title} - Nyeaka` : "Request - Nyeaka" };
}

const RequestDetailPage = async ({
  params,
}: {
  params: Promise<{ request: string }>;
}) => {
  const { request: id } = await params;
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

  return (
    <DetailLayout
      kind={kind}
      eyebrow={`${item.minCondition ? conditionLabel(item.minCondition) : "Any condition"} · ${kindLabel(kind)}`}
      title={item.title}
      place={placeLabel(item.city, item.area)}
      posted={timeAgo(item.createdAt)}
      note={item.description}
      specs={[
        { label: "Device needed", value: kindLabel(kind) },
        { label: "Lowest condition", value: item.minCondition ? conditionLabel(item.minCondition) : "Any" },
        { label: "Pledge", value: "No resale, signed" },
      ]}
      who={item.requester.firstName}
      rating={reputation.rating}
      handoffs={reputation.handoffs}
      backHref="/requests"
      backLabel="← Back to requests"
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
          closedMessage={state === "ACTIVE" ? undefined : "This request has been matched and is no longer open."}
        />
      )}
    </DetailLayout>
  );
};

export default RequestDetailPage;

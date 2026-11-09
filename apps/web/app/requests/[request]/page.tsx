import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { getRequestDetail } from "@/lib/queries";
import { conditionLabel, kindLabel } from "@/lib/device-options";
import { placeLabel, timeAgo } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ request: string }>;
}): Promise<Metadata> {
  const { request } = await params;
  const data = await getRequestDetail(request);
  return { title: data ? `${data.request.title} - Nyeaka` : "Request - Nyeaka" };
}

const RequestDetailPage = async ({
  params,
}: {
  params: Promise<{ request: string }>;
}) => {
  const { request: id } = await params;
  const data = await getRequestDetail(id);
  if (!data) notFound();
  const { request: item, reputation } = data;
  const kind = item.deviceType ?? "OTHER";

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
      <ContactForm mode="offer" who={item.requester.firstName} />
    </DetailLayout>
  );
};

export default RequestDetailPage;

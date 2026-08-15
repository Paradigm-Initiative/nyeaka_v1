import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { REQUESTS } from "@/data/marketplace-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ request: string }>;
}): Promise<Metadata> {
  const { request } = await params;
  const item = REQUESTS.find((r) => r.id === request);
  return { title: item ? `${item.title} - Nyeaka` : "Request - Nyeaka" };
}

const RequestDetailPage = async ({
  params,
}: {
  params: Promise<{ request: string }>;
}) => {
  const { request } = await params;
  const item = REQUESTS.find((r) => r.id === request);
  if (!item) notFound();

  return (
    <DetailLayout
      kind={item.kind}
      eyebrow={`${item.condition} · ${item.kind}`}
      title={item.title}
      place={`${item.area}, ${item.city}`}
      posted={item.posted}
      note={item.note}
      specs={[
        { label: "Device needed", value: item.kind },
        { label: "Lowest condition", value: item.condition },
        { label: "Pledge", value: "No resale, signed" },
      ]}
      who={item.person}
      rating={item.rating}
      handoffs={item.handoffs}
      backHref="/requests"
      backLabel="← Back to requests"
    >
      <ContactForm mode="offer" who={item.person} />
    </DetailLayout>
  );
};

export default RequestDetailPage;

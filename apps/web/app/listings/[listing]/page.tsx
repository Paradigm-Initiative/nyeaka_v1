import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { LISTINGS } from "@/data/marketplace-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ listing: string }>;
}): Promise<Metadata> {
  const { listing } = await params;
  const item = LISTINGS.find((l) => l.id === listing);
  return { title: item ? `${item.title} - Nyeaka` : "Listing - Nyeaka" };
}

const ListingDetailPage = async ({
  params,
}: {
  params: Promise<{ listing: string }>;
}) => {
  const { listing } = await params;
  const item = LISTINGS.find((l) => l.id === listing);
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
        { label: "Brand", value: item.brand },
        { label: "Condition", value: item.condition },
        { label: "Comes with", value: item.extras.join(", ") || "Nothing extra" },
      ]}
      who={item.donor}
      rating={item.rating}
      handoffs={item.handoffs}
      backHref="/listings"
      backLabel="← Back to browsing"
    >
      <ContactForm mode="request" who={item.donor} />
    </DetailLayout>
  );
};

export default ListingDetailPage;

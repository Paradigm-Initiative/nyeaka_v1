import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import OwnerPanel from "@/components/detail/owner-panel";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { getListingDetail } from "@/lib/queries";
import { conditionLabel, kindLabel } from "@/lib/device-options";
import { placeLabel, timeAgo } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ listing: string }>;
}): Promise<Metadata> {
  const { listing } = await params;
  const session = await getServerSession();
  const data = await getListingDetail(listing, session?.user.id);
  return { title: data ? `${data.listing.title} - Nyeaka` : "Listing - Nyeaka" };
}

const ListingDetailPage = async ({
  params,
}: {
  params: Promise<{ listing: string }>;
}) => {
  const { listing: id } = await params;
  const session = await getServerSession();
  const data = await getListingDetail(id, session?.user.id);
  if (!data) notFound();
  const { listing: item, reputation, isOwner, state } = data;

  const extras = [
    item.spec?.hasCharger && "Charger",
    item.spec?.hasKeyboard && "Keyboard",
  ].filter(Boolean) as string[];

  return (
    <DetailLayout
      kind={item.deviceType}
      photos={item.photos}
      eyebrow={`${conditionLabel(item.condition)} · ${kindLabel(item.deviceType)}`}
      title={item.title}
      place={placeLabel(item.city, item.area)}
      posted={timeAgo(item.createdAt)}
      note={item.description}
      specs={[
        { label: "Brand", value: item.brand },
        { label: "Condition", value: conditionLabel(item.condition) },
        { label: "Comes with", value: extras.join(", ") || "Nothing extra" },
      ]}
      who={item.donor.firstName}
      rating={reputation.rating}
      handoffs={reputation.handoffs}
      backHref="/listings"
      backLabel="← Back to browsing"
    >
      {isOwner ? (
        <OwnerPanel kind="listing" id={item.id} state={state} expiresAt={item.expiresAt} />
      ) : (
        <ContactForm mode="request" who={item.donor.firstName} />
      )}
    </DetailLayout>
  );
};

export default ListingDetailPage;

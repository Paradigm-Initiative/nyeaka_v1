import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import OwnerPanel from "@/components/detail/owner-panel";
import type { Metadata } from "next";
import DetailLayout from "@/components/detail/detail-layout";
import ContactForm from "@/components/detail/contact-form";
import { getListingDetail } from "@/lib/queries";
import { getListingOfferContext } from "@/lib/offer-queries";
import { hasDealings } from "@/lib/safety";
import ReportPanel from "@/components/safety/report-panel";
import { placeLabel } from "@/lib/format";
import { getFormatter, getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ listing: string }>;
}): Promise<Metadata> {
  const { listing } = await params;
  const session = await getServerSession();
  const data = await getListingDetail(listing, session?.user.id);
  const t = await getTranslations("titles");
  return { title: `${data ? data.listing.title : t("listing")} - Nyeaka` };
}

const ListingDetailPage = async ({
  params,
}: {
  params: Promise<{ listing: string }>;
}) => {
  const { listing: id } = await params;
  const t = await getTranslations("detail");
  const tDevice = await getTranslations("device");
  const format = await getFormatter();
  const session = await getServerSession();
  const data = await getListingDetail(id, session?.user.id);
  if (!data) notFound();
  const { listing: item, reputation, isOwner, state } = data;

  const viewerId = session?.user.id;
  const context =
    viewerId && !isOwner && state === "ACTIVE"
      ? await getListingOfferContext(viewerId, item.id, item.donor.id)
      : null;

  const canReport = !!viewerId && !isOwner && (await hasDealings(viewerId, item.donor.id));

  const extras = [
    item.spec?.hasCharger && t("charger"),
    item.spec?.hasKeyboard && t("keyboard"),
  ].filter(Boolean) as string[];

  return (
    <DetailLayout
      kind={item.deviceType}
      photos={item.photos}
      eyebrow={`${tDevice(`condition.${item.condition}`)} · ${tDevice(`kind.${item.deviceType}`)}`}
      title={item.title}
      place={placeLabel(item.city, item.area)}
      posted={format.relativeTime(item.createdAt)}
      note={item.description}
      specs={[
        { label: t("brand"), value: item.brand },
        { label: t("condition"), value: tDevice(`condition.${item.condition}`) },
        { label: t("comesWith"), value: extras.join(", ") || t("nothingExtra") },
      ]}
      who={item.donor.firstName}
      whoHref={`/profile/${item.donor.id}`}
      rating={reputation.rating}
      handoffs={reputation.handoffs}
      backHref="/listings"
      backLabel={t("backToBrowsing")}
    >
      {isOwner ? (
        <OwnerPanel kind="listing" id={item.id} state={state} expiresAt={item.expiresAt} />
      ) : (
        <ContactForm
          mode="request"
          who={item.donor.firstName}
          signedIn={!!viewerId}
          targetId={item.id}
          context={context}
          closedMessage={state === "ACTIVE" ? undefined : t("listingClosed")}
        />
      )}
      {canReport && (
        <ReportPanel targetType="LISTING" targetId={item.id} who={t("whoseListing", { name: item.donor.firstName })} label={t("reportListing")} />
      )}
    </DetailLayout>
  );
};

export default ListingDetailPage;

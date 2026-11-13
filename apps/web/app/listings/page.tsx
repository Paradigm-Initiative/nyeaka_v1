import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { parseBrowseParams } from "@/lib/browse-params";
import { getCities, getLiveListings } from "@/lib/queries";
import { getServerSession } from "@/lib/get-session";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("browse")} - Nyeaka` };
}

export const dynamic = "force-dynamic";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseBrowseParams(await searchParams);
  const session = await getServerSession();
  const country = filters.country ?? session?.user.countryCode;
  const [result, cities] = await Promise.all([getLiveListings(filters, session?.user.id, country), getCities("listing", country)]);
  return (
    <BrowsePage
      tab="devices"
      listings={result.items}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      filters={filters}
      cities={cities}
    />
  );
}

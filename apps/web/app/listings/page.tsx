import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { parseBrowseParams } from "@/lib/browse-params";
import { getCities, getLiveListings } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Browse devices - Nyeaka",
};

export const dynamic = "force-dynamic";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseBrowseParams(await searchParams);
  const [result, cities] = await Promise.all([getLiveListings(filters), getCities("listing")]);
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

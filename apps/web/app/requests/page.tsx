import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { parseBrowseParams } from "@/lib/browse-params";
import { getCities, getLiveRequests } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Requests - Nyeaka",
};

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseBrowseParams(await searchParams);
  const [result, cities] = await Promise.all([getLiveRequests(filters), getCities("request")]);
  return (
    <BrowsePage
      tab="requests"
      requests={result.items}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      filters={filters}
      cities={cities}
    />
  );
}

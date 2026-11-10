import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { parseBrowseParams } from "@/lib/browse-params";
import { getCities, getLiveRequests } from "@/lib/queries";
import { getServerSession } from "@/lib/get-session";

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
  const session = await getServerSession();
  const [result, cities] = await Promise.all([getLiveRequests(filters, session?.user.id), getCities("request")]);
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

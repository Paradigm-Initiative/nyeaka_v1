import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { REQUESTS } from "@/data/marketplace-data";

export const metadata: Metadata = {
  title: "Requests - Nyeaka",
};

export default function RequestsPage() {
  return <BrowsePage tab="requests" requests={REQUESTS} />;
}

import type { Metadata } from "next";
import BrowsePage from "@/components/browse/browse-page";
import { LISTINGS } from "@/data/marketplace-data";

export const metadata: Metadata = {
  title: "Browse devices - Nyeaka",
};

export default function ListingsPage() {
  return <BrowsePage tab="devices" listings={LISTINGS} />;
}

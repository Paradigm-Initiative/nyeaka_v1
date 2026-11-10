import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import DashboardView from "@/components/dashboard/dashboard-view";
import {
  getActiveMatches,
  getDashboardOffers,
  getMyListings,
  getMyRequests,
  getReputation,
  getUserProfile,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Dashboard - Nyeaka",
};

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/dashboard");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] || "there";
  const [listings, requests, offers, matches, reputation, profile] = await Promise.all([
    getMyListings(userId),
    getMyRequests(userId),
    getDashboardOffers(userId),
    getActiveMatches(userId),
    getReputation(userId),
    getUserProfile(userId),
  ]);

  return (
    <DashboardView
      firstName={firstName}
      idVerified={profile?.idVerified ?? false}
      reputation={reputation}
      listings={listings}
      requests={requests}
      offers={offers}
      matches={matches}
    />
  );
}

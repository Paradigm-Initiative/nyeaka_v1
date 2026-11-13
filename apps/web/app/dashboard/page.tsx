import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import DashboardView from "@/components/dashboard/dashboard-view";
import { getBlockedUsers } from "@/lib/safety";
import { getMatchesToRate } from "@/lib/ratings";
import {
  getActiveMatches,
  getDashboardOffers,
  getMyListings,
  getMyRequests,
  getReputation,
  getUserProfile,
} from "@/lib/queries";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("titles");
  return { title: `${t("dashboard")} - Nyeaka` };
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/dashboard");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] || "";
  const [listings, requests, offers, matches, blocked, toRate, reputation, profile] = await Promise.all([
    getMyListings(userId),
    getMyRequests(userId),
    getDashboardOffers(userId),
    getActiveMatches(userId),
    getBlockedUsers(userId),
    getMatchesToRate(userId),
    getReputation(userId),
    getUserProfile(userId),
  ]);

  return (
    <DashboardView
      firstName={firstName}
      idVerificationStatus={profile?.idVerificationStatus ?? "NONE"}
      reputation={reputation}
      listings={listings}
      requests={requests}
      offers={offers}
      matches={matches}
      blocked={blocked}
      restricted={!!profile?.restrictedAt}
      toRate={toRate}
    />
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import DashboardView from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard - Nyeaka",
};

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/dashboard");

  const firstName = session.user.name?.split(" ")[0] || "there";

  return <DashboardView firstName={firstName} />;
}

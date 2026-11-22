import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getStaffAccess } from "@/lib/admin";
import TwoFactorSetup from "./setup";

// Outside /admin on purpose: /admin is closed until this is done. Staff only, English only.
export const metadata: Metadata = { title: "Set up two-factor - Nyeaka", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/two-factor/setup");
  const access = await getStaffAccess(session.user.id);
  if (!access) notFound();
  if (access.twoFactor) redirect("/admin");
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <TwoFactorSetup />
      </div>
    </div>
  );
}

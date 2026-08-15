import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import VerifyForm from "@/components/verify/verify-form";

export const metadata: Metadata = {
  title: "Verify your identity - Nyeaka",
};

export default async function VerifyPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/verify");

  return (
    <div className="section-wrapper">
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}

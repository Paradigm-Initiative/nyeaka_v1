import type { Metadata } from "next";
import Link from "next/link";
import { checkInvite, INVITE_ERRORS } from "@/lib/staff-invites";
import AcceptInviteForm from "./accept-invite-form";

// Staff only, English only (like the rest of the admin area).
export const metadata: Metadata = { title: "Accept invite - Nyeaka", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const state = await checkInvite(token);
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="flex flex-col gap-4 w-full max-w-105">
        <h1 className="text-heading-2">Join the Nyeaka staff</h1>
        {state.ok ? (
          <AcceptInviteForm token={token} email={state.email} role={state.role} />
        ) : (
          <>
            <p role="alert">{INVITE_ERRORS[state.reason]}</p>
            <Link href="/sign-in" className="text-link hover:underline">Sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}

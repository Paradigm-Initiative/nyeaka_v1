import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/get-session";

export const metadata: Metadata = {
  title: "Email verified - Nyeaka",
};

export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getServerSession();

  if (error) {
    return (
      <div className="flex flex-1 justify-center items-center py-16 text-center section-wrapper">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-heading-2">This link isn&apos;t valid</h1>
          <p className="max-w-[48ch] text-muted-foreground text-body-lg">
            The verification link is invalid or has expired. Sign in and we&apos;ll
            send you a fresh one.
          </p>
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center items-center py-16 text-center section-wrapper">
      <div className="flex flex-col items-center gap-4">
        <div className="flex justify-center items-center bg-surface-feature border-2 border-pin-green-600 rounded-lg size-14">
          <div className="border-2 border-pin-green-600 rounded-xs w-6.5 h-4.5" />
        </div>
        <h1 className="text-heading-2">
          {session ? `You're verified, ${session.user.name.split(" ")[0]}` : "Email verified"}
        </h1>
        <p className="max-w-[48ch] text-muted-foreground text-body-lg">
          Your email has been confirmed. You can now browse, list a device, or
          ask for one.
        </p>
        <Button asChild>
          <Link href={session ? "/dashboard" : "/sign-in"}>
            {session ? "Go to my dashboard" : "Sign in"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

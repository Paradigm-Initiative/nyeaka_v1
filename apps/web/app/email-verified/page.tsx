import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Email verified - Nyeaka",
};

export default function EmailVerifiedPage() {
  return (
    <div className="flex flex-1 justify-center items-center py-16 text-center section-wrapper">
      <div className="flex flex-col items-center gap-4">
        <div className="flex justify-center items-center bg-surface-feature border-2 border-pin-green-600 rounded-lg size-14">
          <div className="border-2 border-pin-green-600 rounded-xs w-6.5 h-4.5" />
        </div>
        <h1 className="text-heading-2">Email verified</h1>
        <p className="max-w-[48ch] text-muted-foreground text-body-lg">
          Your email has been confirmed. You can now browse, list a device,
          or ask for one.
        </p>
        <Button asChild>
          <Link href="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

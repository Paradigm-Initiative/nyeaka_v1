"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendVerificationEmail } from "@/lib/auth-client";

const COOLDOWN_SECONDS = 60;

export function VerifyEmailNotice() {
  const email = useSearchParams().get("email");
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await sendVerificationEmail({
      email,
      callbackURL: "/email-verified",
    });
    setSending(false);
    if (error) {
      toast.error(error.message || "Could not resend the email");
      return;
    }
    toast.success("Verification email sent");
    setCooldown(COOLDOWN_SECONDS);
  };

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-heading-2">Check your email</h1>
      <p className="text-muted-foreground text-body-md">
        {email ? (
          <>
            We sent a verification link to <strong>{email}</strong>. Click it to
            activate your account. It expires in 1 hour.
          </>
        ) : (
          "We sent you a verification link. Click it to activate your account."
        )}
      </p>
      {email && (
        <Button
          variant="outline"
          onClick={resend}
          disabled={sending || cooldown > 0}
        >
          {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
        </Button>
      )}
      <Button variant="link" asChild className="p-0">
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </div>
  );
}

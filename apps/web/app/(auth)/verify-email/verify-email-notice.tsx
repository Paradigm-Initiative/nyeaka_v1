"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendVerificationEmail } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { useAuthErrorText } from "@/lib/use-error-text";

const COOLDOWN_SECONDS = 60;

export function VerifyEmailNotice() {
  const t = useTranslations("auth.verifyEmail");
  const authError = useAuthErrorText();
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
      toast.error(authError(error.code));
      return;
    }
    toast.success(t("sent"));
    setCooldown(COOLDOWN_SECONDS);
  };

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-heading-2">{t("title")}</h1>
      <p className="text-muted-foreground text-body-md">
        {email ? (
          t.rich("withEmail", { email, strong: (c) => <strong>{c}</strong> })
        ) : (
          t("withoutEmail")
        )}
      </p>
      {email && (
        <Button
          variant="outline"
          onClick={resend}
          disabled={sending || cooldown > 0}
        >
          {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
        </Button>
      )}
      <Button variant="link" asChild className="p-0">
        <Link href="/sign-in">{t("back")}</Link>
      </Button>
    </div>
  );
}

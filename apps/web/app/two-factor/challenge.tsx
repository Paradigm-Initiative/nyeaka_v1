"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { twoFactor } from "@/lib/auth-client";

export default function TwoFactorChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const clean = code.trim();
    const { error } = backup ? await twoFactor.verifyBackupCode({ code: clean }) : await twoFactor.verifyTotp({ code: clean });
    setBusy(false);
    if (error) return void setError(error.message || "That code didn't work. Try again.");
    router.push("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h1 className="text-heading-2">Two-factor sign-in</h1>
      <p className="text-muted-foreground text-body-sm">
        {backup ? "Enter one of your backup codes. Each works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      <Input aria-label={backup ? "Backup code" : "Code"} inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
      {error && <p role="alert" className="font-semibold text-destructive text-body-sm">{error}</p>}
      <Button type="submit" disabled={busy || code.trim().length < 6}>{busy ? "Checking…" : "Verify"}</Button>
      <Button type="button" variant="link" className="self-start" onClick={() => { setBackup(!backup); setCode(""); setError(null); }}>
        {backup ? "Use my authenticator app" : "Use a backup code instead"}
      </Button>
      <p className="text-muted-foreground text-caption">Lost your device and backup codes? Ask another admin to reset your two-factor.</p>
    </form>
  );
}

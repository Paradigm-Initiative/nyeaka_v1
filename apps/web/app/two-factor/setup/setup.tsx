"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { twoFactor } from "@/lib/auth-client";

/** Password -> scan the QR code and save backup codes -> confirm with a code. Nothing is on until the last step. */
export default function TwoFactorSetup() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await twoFactor.enable({ password, method: "totp" });
    if (error || !data || data.method !== "totp") {
      setBusy(false);
      return void setError(error?.message || "That password didn't work.");
    }
    setUri(data.totpURI);
    setBackupCodes(data.backupCodes);
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
    setBusy(false);
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (error) return void setError(error.message || "That code didn't work. Try again.");
    router.push("/admin");
    router.refresh();
  };

  const secret = uri ? new URL(uri).searchParams.get("secret") : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">Set up two-factor sign-in</h1>
      <p className="text-muted-foreground text-body-sm">
        Staff need an authenticator app (Google Authenticator, 1Password, Authy…) before the admin area opens.
      </p>
      {!qr ? (
        <form onSubmit={start} className="flex flex-col gap-3">
          <Input aria-label="Password" type="password" placeholder="Your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="font-semibold text-destructive text-body-sm">{error}</p>}
          <Button type="submit" disabled={busy || !password}>{busy ? "Working…" : "Continue"}</Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2">
            <p className="font-semibold text-body-sm">1. Scan this code with your app</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code for your authenticator app" width={220} height={220} />
            {secret && <p className="text-caption break-all">Can&apos;t scan? Enter this key: <code>{secret}</code></p>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-body-sm">2. Save your backup codes</p>
            <p className="text-muted-foreground text-caption">Each works once if you lose your device. They are shown only now.</p>
            <ul className="gap-1 grid grid-cols-2 bg-surface-feature p-3 rounded-lg font-mono text-body-sm">
              {backupCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved them somewhere safe
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-body-sm">3. Enter the 6-digit code from the app</p>
            <Input aria-label="Code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {error && <p role="alert" className="font-semibold text-destructive text-body-sm">{error}</p>}
          <Button type="submit" disabled={busy || !saved || code.trim().length < 6}>{busy ? "Checking…" : "Turn on two-factor"}</Button>
        </form>
      )}
    </div>
  );
}

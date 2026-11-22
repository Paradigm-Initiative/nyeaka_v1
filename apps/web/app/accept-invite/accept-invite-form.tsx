"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptInviteAction } from "@/actions/staff-invite";

export default function AcceptInviteForm({ token, email, role }: { token: string; email: string; role: "ADMIN" | "REVIEWER" }) {
  const [pending, start] = useTransition();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ promoted: boolean } | null>(null);

  if (done)
    return (
      <>
        <p role="status">{done.promoted ? "Your account now has staff access." : "Your account is ready."} Sign in to continue; you will set up two-factor next.</p>
        <Button asChild><Link href="/sign-in?callbackUrl=/admin">Sign in</Link></Button>
      </>
    );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await acceptInviteAction(token, { firstName: first, lastName: last, password });
          if (!res.ok) return void setError(res.error);
          setDone(res.data);
        });
      }}
    >
      <p className="text-muted-foreground text-body-sm">You were invited as {role === "ADMIN" ? "an admin" : "a reviewer"} with {email}.</p>
      <Input aria-label="First name" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
      <Input aria-label="Last name" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
      <Input aria-label="Password" type="password" placeholder="Password (10+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      <p className="text-muted-foreground text-caption">If you already have a Nyeaka account with this email, your name and password stay as they are.</p>
      {error && <p role="alert" className="font-semibold text-destructive text-body-sm">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create my account"}</Button>
    </form>
  );
}

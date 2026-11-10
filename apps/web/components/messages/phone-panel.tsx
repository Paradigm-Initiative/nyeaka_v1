"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import FormError from "../post/form-error";
import { sharePhoneAction } from "@/actions/lifecycle";
import type { Thread } from "@/lib/messages";

/**
 * Phone numbers stay hidden until both people opt in. Each person's choice is
 * saved on the match; the other person's number only reaches this page once both agree.
 */
const PhonePanel = ({ matchId, who, phone }: { matchId: string; who: string; phone: Thread["phone"] }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entering, setEntering] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string>();

  if (!phone.available) return null;

  const set = (share: boolean, typed?: string) =>
    start(async () => {
      setError(undefined);
      const res = await sharePhoneAction(matchId, { share, phone: typed });
      if (!res.ok) {
        setError(res.fieldErrors?.phone ?? res.error);
        if (!res.fieldErrors?.phone) toast.error(res.error);
        return;
      }
      setEntering(false);
      toast.success(share ? "Number shared" : "No longer sharing your number");
      router.refresh();
    });

  const stopButton = (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(false)}>
      Stop sharing my number
    </Button>
  );

  if (phone.iShared && phone.theyShared && phone.theirNumber)
    return (
      <div className="flex flex-col gap-1.5 bg-surface-feature p-4 border border-pin-green-600 rounded-lg">
        <span className="text-pin-green-600 text-micro-uppercase">Numbers shared</span>
        <a href={`tel:${phone.theirNumber}`} className="text-heading-4 hover:underline">
          {who} — {phone.theirNumber}
        </a>
        <span className="text-muted-foreground text-body-sm">
          {who} can see yours too. Nyeaka keeps the chat either way, in case you need a record.
        </span>
        <div>{stopButton}</div>
      </div>
    );

  if (phone.iShared)
    return (
      <div className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
        <p className="max-w-[46ch] text-muted-foreground text-body-sm">
          You&rsquo;ve agreed to share your number. {who}&rsquo;s appears here as soon as they agree too.
        </p>
        {stopButton}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="max-w-[46ch] text-muted-foreground text-body-sm">
          {phone.theyShared
            ? `${who} has agreed to share their number. Share yours to see it.`
            : "Phone numbers stay hidden until you both agree."}
        </p>
        {!entering && (
          <Button variant="outline" disabled={pending} onClick={() => (phone.hasMine ? set(true) : setEntering(true))}>
            {pending ? "Sharing…" : "Share my number"}
          </Button>
        )}
      </div>
      {entering && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set(true, number);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col gap-1.5 text-body-sm">
            <Label htmlFor="phone-number" className="font-semibold text-body-sm leading-normal">
              Your phone number
            </Label>
            <Input
              id="phone-number"
              type="tel"
              required
              autoFocus
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+234 806 412 0088"
              className="rounded-sm h-12"
            />
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !number.trim()}>
              {pending ? "Sharing…" : "Share"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEntering(false)}>
              Cancel
            </Button>
          </div>
          <span className="text-muted-foreground text-caption">
            Saved to your account. Only shown to {who}, and only once they share theirs.
          </span>
        </form>
      )}
      {!entering && <FormError message={error} />}
    </div>
  );
};

export default PhonePanel;

"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import FormError from "../post/form-error";
import WithdrawButton from "../offers/withdraw-button";
import { createOfferAction } from "@/actions/offers";
import type { OfferContext } from "@/lib/offer-queries";

/**
 * mode "request": viewer is on a listing and asks for the device with one of their requests.
 * mode "offer":   viewer is on a request and offers one of their listings.
 * Either way one Offer row is created; `targetId` is the post on the page.
 */
const ContactForm = ({
  mode,
  who,
  signedIn,
  targetId,
  context,
  closedMessage,
}: {
  mode: "request" | "offer";
  who: string;
  signedIn: boolean;
  targetId: string;
  context: OfferContext | null;
  /** Shown instead of the form when the post is no longer open. */
  closedMessage?: string;
}) => {
  const router = useRouter();
  const [saving, start] = useTransition();
  const firstFree = context?.options.find((o) => !o.blocked)?.id ?? "";
  const [choice, setChoice] = useState(firstFree);
  const [note, setNote] = useState("");
  const [pledge, setPledge] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  if (closedMessage)
    return <p className="bg-surface-feature p-4 rounded-lg text-body-sm">{closedMessage}</p>;

  if (!signedIn) {
    return (
      <div className="flex flex-wrap justify-between items-center gap-3 bg-pin-orange-100 p-4 rounded-lg">
        <p className="max-w-[46ch] text-body-sm">
          Create a free account to{" "}
          {mode === "request" ? "send a request" : "offer a device"} to {who}.
        </p>
        <Button asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    );
  }
  if (!context) return null;

  const newPostHref = mode === "request" ? "/requests/new" : "/listings/new";

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 bg-surface-feature p-4 rounded-lg">
        <span className="badge badge-green">
          {mode === "request" ? "Request sent" : "Offer sent"}
        </span>
        <p className="text-body-md">
          {mode === "request"
            ? `${who} will see this on their dashboard. If they choose you, a chat opens.`
            : `If it's what ${who} needs, they accept and a chat opens so you can agree a public place to meet.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to my dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={mode === "request" ? "/listings" : "/requests"}>Keep browsing</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pendingBanner = context.pending && (
    <div className="flex flex-col items-start gap-2 bg-surface-feature p-4 rounded-lg">
      {context.pending.initiatedByMe ? (
        <>
          <span className="badge badge-orange">Waiting for {who}</span>
          <p className="text-body-sm">
            You sent an offer using &ldquo;{context.pending.yourPost}&rdquo;. You&rsquo;ll find the answer on your dashboard.
          </p>
          <WithdrawButton offerId={context.pending.id} />
        </>
      ) : (
        <>
          <span className="badge badge-green">{who} sent you an offer</span>
          <p className="text-body-sm">
            Accept or decline it from your dashboard.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </>
      )}
    </div>
  );

  if (context.locked) return pendingBanner;

  if (context.options.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 bg-pin-orange-100 p-4 rounded-lg">
        {pendingBanner}
        <p className="text-body-sm">
          {mode === "request"
            ? `To ask ${who} for this device you need a live request of your own.`
            : `To offer ${who} a device you need a live listing of your own.`}
        </p>
        <Button asChild>
          <Link href={newPostHref}>{mode === "request" ? "Post a request" : "List a device"}</Link>
        </Button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setFieldErrors({});
    start(async () => {
      const res = await createOfferAction({
        listingId: mode === "request" ? targetId : choice,
        requestId: mode === "request" ? choice : targetId,
        message: note,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(mode === "request" ? "Request sent" : "Offer sent");
      setSent(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {pendingBanner}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <span className="font-heading font-semibold text-heading-6">
          {mode === "request" ? `Tell ${who} why you need it` : `Offer ${who} a device`}
        </span>

        <label className="flex flex-col gap-1.5 text-body-sm">
          <span className="font-semibold">
            {mode === "request" ? "Which of your requests is this for?" : "Which device are you offering?"}
          </span>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="bg-background px-3 border rounded-sm min-h-11"
          >
            {context.options.map((o) => (
              <option key={o.id} value={o.id} disabled={!!o.blocked}>
                {o.title} · {o.place}
                {o.blocked ? ` — ${o.blocked}` : ""}
              </option>
            ))}
          </select>
          <FormError message={fieldErrors.listingId ?? fieldErrors.requestId} />
        </label>

        <Textarea
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            mode === "request"
              ? "A short note — what it's for, and when you could collect it. Donors read these before choosing."
              : "Say what you have and its condition — model, age, anything wrong with it. Be honest; it saves you both a trip."
          }
          className="min-h-26 rounded-sm"
        />
        <FormError message={fieldErrors.message} />

        {mode === "request" ? (
          <label className="flex items-start gap-2.5 text-muted-foreground text-body-sm">
            <input
              type="checkbox"
              required
              checked={pledge}
              onChange={(e) => setPledge(e.target.checked)}
              className="accent-pin-green-600 mt-0.5 size-4.5"
            />
            <span>
              I am asking for this device for my own use and I will not resell
              it. {who} can see this pledge on my request.
            </span>
          </label>
        ) : (
          <div className="bg-surface-feature p-3 rounded-lg text-body-sm">
            {who} has signed the no-resale pledge. If they accept your offer,
            a chat opens and you agree a public place to meet.
          </div>
        )}

        <FormError message={error} />
        <Button type="submit" className="self-start" disabled={saving || !choice}>
          {saving ? "Sending…" : mode === "request" ? "Send request" : "Offer a device"}
        </Button>
      </form>
    </div>
  );
};

export default ContactForm;

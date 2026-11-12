"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import FormError from "../post/form-error";
import WithdrawButton from "../offers/withdraw-button";
import { createOfferAction } from "@/actions/offers";
import type { OfferContext } from "@/lib/offer-queries";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

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
  const t = useTranslations("contact");
  const errText = useErrorText();
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
          {t(mode === "request" ? "signedOutRequest" : "signedOutOffer", { who })}
        </p>
        <Button asChild>
          <Link href="/sign-up">{t("createAccount")}</Link>
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
          {t(mode === "request" ? "requestSent" : "offerSent")}
        </span>
        <p className="text-body-md">
          {t(mode === "request" ? "sentBodyRequest" : "sentBodyOffer", { who })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">{t("dashboard")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={mode === "request" ? "/listings" : "/requests"}>{t("keepBrowsing")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pendingBanner = context.pending && (
    <div className="flex flex-col items-start gap-2 bg-surface-feature p-4 rounded-lg">
      {context.pending.initiatedByMe ? (
        <>
          <span className="badge badge-orange">{t("waitingFor", { who })}</span>
          <p className="text-body-sm">
            {t("youSentOffer", { post: context.pending.yourPost })}
          </p>
          <WithdrawButton offerId={context.pending.id} />
        </>
      ) : (
        <>
          <span className="badge badge-green">{t("sentYouOffer", { who })}</span>
          <p className="text-body-sm">
            {t("answerFromDashboard")}
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard">{t("openDashboard")}</Link>
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
          {t(mode === "request" ? "needRequest" : "needListing", { who })}
        </p>
        <Button asChild>
          <Link href={newPostHref}>{t(mode === "request" ? "postRequest" : "listDevice")}</Link>
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
        setError(errText(res.error));
        setFieldErrors(errText.fields(res.fieldErrors));
        return;
      }
      toast.success(t(mode === "request" ? "requestSent" : "offerSent"));
      setSent(true);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {pendingBanner}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <span className="font-heading font-semibold text-heading-6">
          {t(mode === "request" ? "headingRequest" : "headingOffer", { who })}
        </span>

        <div className="flex flex-col gap-1.5 text-body-sm">
          <Label htmlFor="choice" className="font-semibold text-body-sm leading-normal">
            {t(mode === "request" ? "whichRequest" : "whichDevice")}
          </Label>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="choice" className="rounded-sm min-h-11">
              <SelectValue placeholder={t("chooseOne")} />
            </SelectTrigger>
            <SelectContent>
              {context.options.map((o) => (
                <SelectItem key={o.id} value={o.id} disabled={!!o.blocked}>
                  {o.title} · {o.place}
                  {o.blocked ? ` — ${errText(o.blocked)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormError message={fieldErrors.listingId ?? fieldErrors.requestId} />
        </div>

        <Textarea
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            t(mode === "request" ? "notePlaceholderRequest" : "notePlaceholderOffer")
          }
          className="min-h-26 rounded-sm"
        />
        <FormError message={fieldErrors.message} />

        {mode === "request" ? (
          <Label
            htmlFor="pledge"
            className="items-start gap-2.5 font-normal text-muted-foreground text-body-sm leading-normal"
          >
            <Checkbox
              id="pledge"
              required
              checked={pledge}
              onCheckedChange={(v) => setPledge(v === true)}
              className="mt-0.5"
            />
            <span>
              {t("pledge", { who })}
            </span>
          </Label>
        ) : (
          <div className="bg-surface-feature p-3 rounded-lg text-body-sm">
            {t("pledgeSigned", { who })}
          </div>
        )}

        <FormError message={error} />
        <Button type="submit" className="self-start" disabled={saving || !choice}>
          {saving ? t("sending") : t(mode === "request" ? "sendRequest" : "offerDevice")}
        </Button>
      </form>
    </div>
  );
};

export default ContactForm;

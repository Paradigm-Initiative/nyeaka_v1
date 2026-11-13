"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import PhoneInput, { isValidPhoneNumber, type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import enLabels from "react-phone-number-input/locale/en.json";
import frLabels from "react-phone-number-input/locale/fr.json";
import ptLabels from "react-phone-number-input/locale/pt.json";
import { Label } from "../ui/label";
import FormError from "../post/form-error";
import { sharePhoneAction } from "@/actions/lifecycle";
import type { Thread } from "@/lib/messages";
import { useLocale, useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

/**
 * Phone numbers stay hidden until both people opt in. Each person's choice is
 * saved on the match; the other person's number only reaches this page once both agree.
 */
const PhonePanel = ({ matchId, who, phone }: { matchId: string; who: string; phone: Thread["phone"] }) => {
  const t = useTranslations("phone");
  const labels = { en: enLabels, fr: frLabels, pt: ptLabels }[useLocale() as "en" | "fr" | "pt"] ?? enLabels;
  const errText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entering, setEntering] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string>();

  if (!phone.available) return null;

  const set = (share: boolean, typed?: string) =>
    start(async () => {
      setError(undefined);
      // Typed numbers are checked here for a quick answer; the server checks again.
      if (typed !== undefined && !isValidPhoneNumber(typed)) {
        setError(errText("invalidPhone"));
        return;
      }
      const res = await sharePhoneAction(matchId, { share, phone: typed });
      if (!res.ok) {
        setError(errText(res.fieldErrors?.phone ?? res.error));
        if (!res.fieldErrors?.phone) toast.error(errText(res.error));
        return;
      }
      setEntering(false);
      toast.success(share ? t("shared") : t("stopped"));
      router.refresh();
    });

  const stopButton = (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => set(false)}>
      {t("stop")}
    </Button>
  );

  if (phone.iShared && phone.theyShared && phone.theirNumber)
    return (
      <div className="flex flex-col gap-1.5 bg-surface-feature p-4 border border-pin-green-600 rounded-lg">
        <span className="text-pin-green-600 text-micro-uppercase">{t("numbersShared")}</span>
        <a href={`tel:${phone.theirNumber}`} className="text-heading-4 hover:underline">
          {t("whoNumber", { who, number: phone.theirNumber })}
        </a>
        <span className="text-muted-foreground text-body-sm">
          {t("theyCanSee", { who })}
        </span>
        <div>{stopButton}</div>
      </div>
    );

  if (phone.iShared)
    return (
      <div className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
        <p className="max-w-[46ch] text-muted-foreground text-body-sm">
          {t("youAgreed", { who })}
        </p>
        {stopButton}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="max-w-[46ch] text-muted-foreground text-body-sm">
          {phone.theyShared ? t("theyAgreed", { who }) : t("hidden")}
        </p>
        {!entering && (
          <Button variant="outline" disabled={pending} onClick={() => (phone.hasMine ? set(true) : setEntering(true))}>
            {pending ? t("sharing") : t("share")}
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
              {t("yourNumber")}
            </Label>
            <PhoneInput
              id="phone-number"
              international
              countryCallingCodeEditable={false}
              defaultCountry={phone.country as Country}
              labels={labels}
              value={number}
              onChange={(v) => setNumber(v ?? "")}
              inputComponent={Input}
              className="phone-field"
              numberInputProps={{ className: "rounded-sm h-12", autoFocus: true, required: true }}
            />
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !number.trim()}>
              {pending ? t("sharing") : t("shareShort")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEntering(false)}>
              {t("cancel")}
            </Button>
          </div>
          <span className="text-muted-foreground text-caption">
            {t("saved", { who })}
          </span>
        </form>
      )}
      {!entering && <FormError message={error} />}
    </div>
  );
};

export default PhonePanel;

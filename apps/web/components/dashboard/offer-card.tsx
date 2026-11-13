"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import WithdrawButton from "../offers/withdraw-button";
import { acceptOfferAction, declineOfferAction } from "@/actions/matchings";
import type { DashboardOffer } from "@/lib/queries";
import { useFormatter, useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

/**
 * One offer on the dashboard.
 * received + PENDING -> accept / decline.  sent + PENDING -> withdraw.  sent + DECLINED -> "not selected".
 */
const OfferCard = ({ offer: o }: { offer: DashboardOffer }) => {
  const t = useTranslations("offerCard");
  const errText = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const [pending, start] = useTransition();

  const answer = (kind: "accept" | "decline") =>
    start(async () => {
      const res = kind === "accept" ? await acceptOfferAction(o.id) : await declineOfferAction(o.id);
      if (!res.ok) {
        toast.error(errText(res.error));
        router.refresh(); // the offer may have been answered or withdrawn elsewhere
        return;
      }
      toast.success(t(kind === "accept" ? "accepted" : "declined"));
      router.refresh();
    });

  // What the other person is offering or asking for, from the viewer's point of view.
  const vars = { name: o.other.firstName, title: o.listingTitle };
  const headline =
    o.direction === "received"
      ? t(o.role === "donor" ? "headlineWantsYours" : "headlineOffers", vars)
      : t(o.role === "donor" ? "headlineYouOffered" : "headlineYouAsked", vars);

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="flex justify-center items-center bg-surface-feature rounded-full size-11 font-heading font-bold text-pin-green-600">
            {o.other.firstName[0]?.toUpperCase()}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-5">{headline}</span>
            <span className="text-muted-foreground text-body-sm">
              {t("meta", { request: o.requestTitle, place: o.place, time: format.relativeTime(o.createdAt) })}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {o.other.idVerificationStatus === "VERIFIED" && <span className="badge badge-green">{t("verified")}</span>}
          {o.status === "DECLINED" && <span className="badge badge-orange">{t("notSelected")}</span>}
          {o.status === "PENDING" && o.direction === "sent" && <span className="badge badge-orange">{t("waiting")}</span>}
        </div>
      </div>

      <p className="text-body-md text-pretty">
        &ldquo;{o.message ?? o.requestDescription}&rdquo;
      </p>

      {o.status === "DECLINED" && (
        <p className="text-muted-foreground text-body-sm">
          {t(o.role === "donor" ? "declinedDonor" : "declinedRequester")}
        </p>
      )}

      {o.status === "PENDING" && o.direction === "received" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => answer("accept")}>
            {pending ? t("working") : t("accept")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("decline")}>
            {t("decline")}
          </Button>
        </div>
      )}

      {o.status === "PENDING" && o.direction === "sent" && (
        <div>
          <WithdrawButton offerId={o.id} />
        </div>
      )}
    </div>
  );
};

export default OfferCard;

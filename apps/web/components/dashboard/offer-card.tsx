"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import WithdrawButton from "../offers/withdraw-button";
import { acceptOfferAction, declineOfferAction } from "@/actions/matchings";
import type { DashboardOffer } from "@/lib/queries";
import { timeAgo } from "@/lib/format";

/**
 * One offer on the dashboard.
 * received + PENDING -> accept / decline.  sent + PENDING -> withdraw.  sent + DECLINED -> "not selected".
 */
const OfferCard = ({ offer: o }: { offer: DashboardOffer }) => {
  const router = useRouter();
  const [pending, start] = useTransition();

  const answer = (kind: "accept" | "decline") =>
    start(async () => {
      const res = kind === "accept" ? await acceptOfferAction(o.id) : await declineOfferAction(o.id);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh(); // the offer may have been answered or withdrawn elsewhere
        return;
      }
      toast.success(kind === "accept" ? "Accepted. A chat is now open." : "Declined");
      router.refresh();
    });

  // What the other person is offering or asking for, from the viewer's point of view.
  const subject =
    o.role === "donor"
      ? `wants your ${o.listingTitle}`
      : `offers ${o.listingTitle}`;
  const headline =
    o.direction === "received"
      ? `${o.other.firstName} ${subject}`
      : o.role === "donor"
        ? `You offered ${o.listingTitle} to ${o.other.firstName}`
        : `You asked ${o.other.firstName} for ${o.listingTitle}`;

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
              For &ldquo;{o.requestTitle}&rdquo; · {o.place} · {timeAgo(o.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {o.other.idVerified && <span className="badge badge-green">ID-verified</span>}
          {o.status === "DECLINED" && <span className="badge badge-orange">Not selected</span>}
          {o.status === "PENDING" && o.direction === "sent" && <span className="badge badge-orange">Waiting</span>}
        </div>
      </div>

      <p className="text-body-md text-pretty">
        &ldquo;{o.message ?? o.requestDescription}&rdquo;
      </p>

      {o.status === "DECLINED" && (
        <p className="text-muted-foreground text-body-sm">
          {o.role === "donor"
            ? "This request went to someone else or turned your offer down."
            : "This device went to someone else or the donor turned your request down."}{" "}
          Your {o.role === "donor" ? "device" : "request"} stays live.
        </p>
      )}

      {o.status === "PENDING" && o.direction === "received" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => answer("accept")}>
            {pending ? "Working…" : "Accept"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("decline")}>
            Decline
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

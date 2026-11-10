"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardMatch, DashboardOffer, getMyListings, getMyRequests, getReputation } from "@/lib/queries";
import type { getBlockedUsers } from "@/lib/safety";
import type { RatingPrompt } from "@/lib/ratings";
import UnblockButton from "../safety/unblock-button";
import { conditionLabel } from "@/lib/device-options";
import { postState, type PostState } from "@/lib/lifecycle";
import PostActions from "../post/post-actions";
import { placeLabel, timeAgo } from "@/lib/format";
import { Button } from "../ui/button";
import OfferCard from "./offer-card";
import MatchCard from "./match-card";

const STATE_BADGE: Record<PostState, { label: string; cls: string }> = {
  ACTIVE: { label: "Live", cls: "badge-green" },
  EXPIRED: { label: "Expired", cls: "badge-orange" },
  CLOSED: { label: "Closed", cls: "badge-orange" },
  MATCHED: { label: "Matched", cls: "badge-green" },
};

const plural = (n: number) => `${n} offer${n === 1 ? "" : "s"}`;

type Props = {
  firstName: string;
  idVerified: boolean;
  reputation: Awaited<ReturnType<typeof getReputation>>;
  listings: Awaited<ReturnType<typeof getMyListings>>;
  requests: Awaited<ReturnType<typeof getMyRequests>>;
  offers: DashboardOffer[];
  matches: DashboardMatch[];
  blocked: Awaited<ReturnType<typeof getBlockedUsers>>;
  restricted: boolean;
  toRate: RatingPrompt[];
};

const DashboardView = ({ firstName, idVerified, reputation, listings, requests, offers, matches, blocked, restricted, toRate }: Props) => {
  const [role, setRole] = useState<"donor" | "requester">("donor");

  // Everything below is filtered to the hat the user is wearing in the current tab.
  const mine = (r: "donor" | "requester") => ({
    received: offers.filter((o) => o.role === r && o.direction === "received" && o.status === "PENDING"),
    sent: offers.filter((o) => o.role === r && o.direction === "sent"),
    matches: matches.filter((m) => m.role === r),
  });
  const view = mine(role);
  const waiting = { donor: mine("donor").received.length, requester: mine("requester").received.length };

  return (
    <div className="flex flex-col gap-6 w-full section-wrapper">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-heading-2">Hello {firstName}</h1>
        <div className="flex gap-1 p-1 border border-hairline-strong rounded-md">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRole("donor")}
            className={cn(
              "px-4.5 rounded-sm min-h-11",
              role === "donor"
                ? "bg-pin-gray-900 hover:bg-pin-gray-900 text-white hover:text-white"
                : "text-muted-foreground",
            )}
          >
            Giving
            {waiting.donor > 0 && <span className="ml-2 bg-pin-orange-100 px-1.5 rounded-full text-pin-gray-900 text-xs">{waiting.donor}</span>}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRole("requester")}
            className={cn(
              "px-4.5 rounded-sm min-h-11",
              role === "requester"
                ? "bg-pin-gray-900 hover:bg-pin-gray-900 text-white hover:text-white"
                : "text-muted-foreground",
            )}
          >
            Asking
            {waiting.requester > 0 && <span className="ml-2 bg-pin-orange-100 px-1.5 rounded-full text-pin-gray-900 text-xs">{waiting.requester}</span>}
          </Button>
        </div>
      </div>

      {restricted && (
        <div role="alert" className="bg-pin-orange-100 p-4 rounded-lg text-body-sm">
          Your account is restricted while we review reports about it. You can
          still browse, chat and finish matches you already have, but you can&rsquo;t
          post listings or requests or send offers.
        </div>
      )}

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
        <div className="flex flex-col gap-1 p-4 border rounded-lg">
          <span className="text-heading-3">
            {reputation.rating !== null ? `${reputation.rating.toFixed(1)} ★` : "—"}
          </span>
          <span className="text-muted-foreground text-body-sm">
            Your rating, {reputation.ratingCount} review{reputation.ratingCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-col gap-1 p-4 border rounded-lg">
          <span className="text-heading-3">{reputation.handoffs}</span>
          <span className="text-muted-foreground text-body-sm">
            Completed handoffs
          </span>
        </div>
        <div className="flex flex-col gap-1 p-4 border rounded-lg">
          <span className={cn("text-heading-3", idVerified && "text-pin-green-600")}>
            {idVerified ? "Verified" : "Not verified"}
          </span>
          <span className="text-muted-foreground text-body-sm">
            {idVerified ? "NIN and ID confirmed" : <Link href="/verify" className="text-link hover:underline">Verify your identity</Link>}
          </span>
        </div>
      </div>

      <RatePrompts toRate={toRate} />

      {role === "donor" ? (
        <div className="flex flex-col gap-6">
          <OfferSections
            title="Requests for your devices"
            empty="No one has asked for your devices yet."
            view={view}
          />

          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Your listings</h2>
            <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => {
                const state = postState(l.status, l.expiresAt);
                return (
                  <div key={l.id} className="flex flex-col gap-2 p-4 border rounded-lg">
                    <Link href={`/listings/${l.id}`} className="font-heading font-semibold text-heading-5 hover:underline">
                      {l.title}
                    </Link>
                    <span className="text-muted-foreground text-body-sm">
                      {placeLabel(l.city, l.area)} · {conditionLabel(l.condition)} · listed {timeAgo(l.createdAt)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("badge", STATE_BADGE[state].cls)}>{STATE_BADGE[state].label}</span>
                      {state === "ACTIVE" && <span className="badge badge-orange">{plural(l._count.offers)}</span>}
                    </div>
                    <PostActions kind="listing" id={l.id} state={state} />
                  </div>
                );
              })}
              <Link
                href="/listings/new"
                className="flex flex-col justify-center gap-1.5 p-4 border border-hairline-strong border-dashed rounded-lg min-h-27"
              >
                <span className="font-heading font-semibold text-heading-5 text-pin-green-600">
                  + List {listings.length ? "another" : "a"} device
                </span>
                <span className="text-muted-foreground text-body-sm">Two minutes</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <OfferSections
            title="Offers for your requests"
            empty="No one has offered a device yet."
            view={view}
          />
          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Your requests</h2>
            <div className="flex flex-col gap-3">
              {requests.map((r) => {
                const state = postState(r.status, r.expiresAt);
                return (
                  <div key={r.id} className="flex flex-col gap-2 p-4 border rounded-lg">
                    <Link href={`/requests/${r.id}`} className="font-heading font-semibold text-heading-5 hover:underline">
                      {r.title}
                    </Link>
                    <span className="text-muted-foreground text-body-sm">
                      {r.minCondition ? `${conditionLabel(r.minCondition)} or better` : "Any condition"} · {placeLabel(r.city, r.area)} · posted {timeAgo(r.createdAt)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("badge", STATE_BADGE[state].cls)}>{STATE_BADGE[state].label}</span>
                      {state === "ACTIVE" && <span className="badge badge-orange">{plural(r._count.offers)}</span>}
                    </div>
                    <PostActions kind="request" id={r.id} state={state} />
                  </div>
                );
              })}
              <Link
                href="/requests/new"
                className="flex flex-col justify-center gap-1.5 p-4 border border-hairline-strong border-dashed rounded-lg min-h-27"
              >
                <span className="font-heading font-semibold text-heading-5 text-pin-green-600">
                  + Ask for {requests.length ? "another" : "a"} device
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <BlockedList blocked={blocked} />
    </div>
  );
};

/** Ended matches still waiting for the user's rating. Hidden when there are none. */
const RatePrompts = ({ toRate }: { toRate: RatingPrompt[] }) =>
  toRate.length === 0 ? null : (
    <div className="flex flex-col gap-3">
      <h2 className="text-heading-3">Rate your handoffs</h2>
      {toRate.map((p) => (
        <div key={p.matchId} className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-5">
              {p.status === "HANDED_OVER" ? `How did it go with ${p.otherFirstName}?` : `Rate ${p.otherFirstName}`}
            </span>
            <span className="text-muted-foreground text-body-sm">
              {p.listingTitle} · {p.status === "HANDED_OVER" ? "handed over" : "match cancelled"} {timeAgo(p.endedAt)}
            </span>
          </div>
          {p.conversationId && (
            <Button asChild size="sm">
              <Link href={`/messages/${p.conversationId}`}>Rate</Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );

/** People you have blocked, with a way to undo it. Hidden when there are none. */
const BlockedList = ({ blocked }: { blocked: Props["blocked"] }) =>
  blocked.length === 0 ? null : (
    <div className="flex flex-col gap-3">
      <h2 className="text-heading-3">Blocked people</h2>
      <div className="flex flex-col gap-2">
        {blocked.map((b) => (
          <div key={b.blockedId} className="flex flex-wrap justify-between items-center gap-3 p-3 border rounded-lg">
            <span className="text-body-md">{b.blocked.firstName}</span>
            <UnblockButton userId={b.blockedId} who={b.blocked.firstName} />
          </div>
        ))}
      </div>
    </div>
  );

/** Matches first (they have a live chat), then offers to answer, then offers waiting on others. */
const OfferSections = ({
  title,
  empty,
  view,
}: {
  title: string;
  empty: string;
  view: { received: DashboardOffer[]; sent: DashboardOffer[]; matches: DashboardMatch[] };
}) => (
  <div className="flex flex-col gap-6">
    {view.matches.length > 0 && (
      <div className="flex flex-col gap-3">
        <h2 className="text-heading-3">Active matches</h2>
        {view.matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    )}
    <div className="flex flex-col gap-3">
      <h2 className="text-heading-3">{title}</h2>
      {view.received.length === 0 ? (
        <p className="text-muted-foreground text-body-sm">{empty}</p>
      ) : (
        view.received.map((o) => <OfferCard key={o.id} offer={o} />)
      )}
    </div>
    {view.sent.length > 0 && (
      <div className="flex flex-col gap-3">
        <h2 className="text-heading-3">Sent by you</h2>
        {view.sent.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
    )}
  </div>
);

export default DashboardView;

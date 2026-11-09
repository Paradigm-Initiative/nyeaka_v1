"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { getIncomingOffers, getMyListings, getMyRequests, getReputation } from "@/lib/queries";
import { conditionLabel } from "@/lib/device-options";
import { postState, type PostState } from "@/lib/lifecycle";
import PostActions from "../post/post-actions";
import { placeLabel, timeAgo } from "@/lib/format";

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
  incoming: Awaited<ReturnType<typeof getIncomingOffers>>;
};

const DashboardView = ({ firstName, idVerified, reputation, listings, requests, incoming }: Props) => {
  const [role, setRole] = useState<"donor" | "requester">("donor");

  return (
    <div className="flex flex-col gap-6 section-wrapper">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-heading-2">Hello {firstName}</h1>
        <div className="flex gap-1 p-1 border border-hairline-strong rounded-md">
          <button
            type="button"
            onClick={() => setRole("donor")}
            className={cn(
              "min-h-11 rounded-sm px-4.5 py-2.5 font-heading text-sm font-semibold",
              role === "donor"
                ? "bg-pin-gray-900 text-white"
                : "text-muted-foreground",
            )}
          >
            Giving
          </button>
          <button
            type="button"
            onClick={() => setRole("requester")}
            className={cn(
              "min-h-11 rounded-sm px-4.5 py-2.5 font-heading text-sm font-semibold",
              role === "requester"
                ? "bg-pin-gray-900 text-white"
                : "text-muted-foreground",
            )}
          >
            Asking
          </button>
        </div>
      </div>

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

      {role === "donor" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Incoming requests</h2>
            {incoming.length === 0 ? (
              <p className="text-muted-foreground text-body-sm">
                No pending offers yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {incoming.map((o) => (
                  <div key={o.id} className="flex flex-col gap-3 p-4 border rounded-lg">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex justify-center items-center bg-surface-feature rounded-full size-11 font-heading font-bold text-pin-green-600">
                          {o.request.requester.firstName[0]?.toUpperCase()}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-heading font-semibold text-heading-5">
                            {o.request.requester.firstName}
                          </span>
                          <span className="text-muted-foreground text-body-sm">
                            {placeLabel(o.request.city, o.request.area)} · for {o.listing.title} · {timeAgo(o.createdAt)}
                          </span>
                        </div>
                      </div>
                      {o.request.requester.idVerified && (
                        <span className="badge badge-green">ID-verified</span>
                      )}
                    </div>
                    <p className="text-body-md text-pretty">
                      &ldquo;{o.message ?? o.request.description}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

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
      )}
    </div>
  );
};

export default DashboardView;

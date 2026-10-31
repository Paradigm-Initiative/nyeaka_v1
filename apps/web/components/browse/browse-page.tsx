"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import OrganicEdge from "@/components/layout/organic-edge";
import { useSession } from "@/lib/auth-client";
import { CITIES } from "@/data/marketplace-data";
import { MockListing, MockRequest } from "@/types/types";
import { Button } from "../ui/button";
import ListingCard from "../listing-card";
import RequestCard from "../request-card";

type BrowseTab = "devices" | "requests";

const BrowsePage = ({
  tab,
  listings,
  requests,
}: {
  tab: BrowseTab;
  listings?: MockListing[];
  requests?: MockRequest[];
}) => {
  const [city, setCity] = useState("All cities");
  const { data: session, isPending } = useSession();

  const items = useMemo(() => {
    const source = tab === "devices" ? listings ?? [] : requests ?? [];
    return source.filter((x) => city === "All cities" || x.city === city);
  }, [tab, listings, requests, city]);

  const heading =
    tab === "devices" ? "What's available near you" : "People asking nearby";
  const description =
    tab === "devices"
      ? "Browse freely. Names, photos and contact details open up once you verify your identity."
      : "See what people near you need. Offering a device opens a chat once they accept.";

  return (
    <div className="flex flex-col">
      <div className="bg-canvas-dark">
        <div className="flex flex-col gap-3 section-wrapper pb-6!">
          <h1 className="text-heading-1 text-pin-gray-50">{heading}</h1>
          <p className="max-w-[56ch] text-body-md text-pin-gray-400">
            {description}
          </p>
          <div className="flex gap-1 bg-white/8 mt-2 p-1 rounded-md w-fit">
            <Link
              href="/listings"
              className={cn(
                "rounded-sm px-4.5 py-2.5 font-heading text-sm font-semibold",
                tab === "devices"
                  ? "bg-white text-pin-gray-900"
                  : "text-pin-gray-400 hover:text-pin-gray-50",
              )}
            >
              Devices available
            </Link>
            <Link
              href="/requests"
              className={cn(
                "rounded-sm px-4.5 py-2.5 font-heading text-sm font-semibold",
                tab === "requests"
                  ? "bg-white text-pin-gray-900"
                  : "text-pin-gray-400 hover:text-pin-gray-50",
              )}
            >
              People asking
            </Link>
          </div>
        </div>
      </div>
      <OrganicEdge />

      <div className="flex flex-col gap-4 section-wrapper">
        <div className="flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              className={cn(
                "min-h-10 rounded-sm border px-3.5 py-2 font-heading text-sm font-semibold",
                c === city
                  ? "bg-pin-gray-900 text-white border-pin-gray-900"
                  : "border-hairline-strong text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="text-muted-foreground text-body-sm">
          {items.length}{" "}
          {tab === "devices" ? "devices available" : "open requests"}
        </p>

        {items.length === 0 ? (
          <div className="p-14 border border-hairline-strong border-dashed rounded-lg text-body-md text-muted-foreground text-center">
            Nothing listed in this city yet. Try another, or post a{" "}
            {tab === "devices" ? "request" : "listing"} so people nearby can
            see you.
          </div>
        ) : (
          <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tab === "devices"
              ? (items as MockListing[]).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))
              : (items as MockRequest[]).map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
          </div>
        )}

        {!isPending && !session && (
          <div className="flex flex-wrap justify-between items-center gap-3 bg-pin-orange-100 p-4 rounded-lg">
            <p className="max-w-[60ch] text-body-md">
              You&apos;re seeing summaries only. Create an account to open a
              listing, read the note and send a request.
            </p>
            <Button asChild>
              <Link href="/sign-up">Create an account</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowsePage;

"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import OrganicEdge from "@/components/layout/organic-edge";
import { useSession } from "@/lib/auth-client";
import type { ListingCardData, RequestCardData } from "@/lib/queries";
import { browseHref, type BrowseFilters } from "@/lib/browse-params";
import { KIND_OPTIONS } from "@/lib/device-options";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ListingCard from "../listing-card";
import RequestCard from "../request-card";

type BrowseTab = "devices" | "requests";

// Radix Select items cannot have an empty value, so "no city filter" gets a sentinel.
const ALL_CITIES = "__all__";

const BrowsePage = ({
  tab,
  listings,
  requests,
  cities,
  total,
  page,
  pageCount,
  filters,
}: {
  tab: BrowseTab;
  listings?: ListingCardData[];
  requests?: RequestCardData[];
  cities: string[];
  total: number;
  page: number;
  pageCount: number;
  filters: BrowseFilters;
}) => {
  const basePath = tab === "devices" ? "/listings" : "/requests";
  const items = tab === "devices" ? listings ?? [] : requests ?? [];
  const hasFilters = Boolean(filters.q || filters.type || filters.city);
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // The search box and city share one GET form; picking a city applies it straight away.
  const pickCity = (value: string) => {
    const q = String(new FormData(formRef.current ?? undefined).get("q") ?? "").trim();
    router.push(
      browseHref(basePath, { ...filters, q, city: value === ALL_CITIES ? undefined : value, page: 1 }),
    );
  };

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
          <div className="flex gap-1 bg-white/8 mt-2 p-1 rounded-md w-full sm:w-fit">
            <Link
              href="/listings"
              className={cn(
                "flex-1 sm:flex-none rounded-sm px-4.5 py-2.5 min-h-11 text-center font-heading text-sm font-semibold",
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
                "flex-1 sm:flex-none rounded-sm px-4.5 py-2.5 min-h-11 text-center font-heading text-sm font-semibold",
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
        <form
          ref={formRef}
          key={`${filters.q}|${filters.city}|${filters.type}`}
          action={basePath}
          className="flex flex-wrap gap-2"
        >
          {filters.type && <input type="hidden" name="type" value={filters.type} />}
          {filters.city && <input type="hidden" name="city" value={filters.city} />}
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder={tab === "devices" ? "Search brand or model" : "Search requests"}
            aria-label="Search"
            className="rounded-sm w-full sm:flex-1 sm:basis-0 sm:w-auto h-11"
          />
          <Select value={filters.city ?? ALL_CITIES} onValueChange={pickCity}>
            <SelectTrigger aria-label="City" className="flex-1 sm:flex-none rounded-sm sm:w-44 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={ALL_CITIES}>All cities</SelectItem>
              {filters.city && !cities.includes(filters.city) && (
                <SelectItem value={filters.city}>{filters.city}</SelectItem>
              )}
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" className="h-11 px-6">Search</Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {[{ label: "All devices", value: undefined }, ...KIND_OPTIONS].map((o) => (
            <Link
              key={o.label}
              href={browseHref(basePath, { ...filters, type: o.value, page: 1 })}
              className={cn(
                "min-h-10 rounded-sm border px-3.5 py-2 font-heading text-sm font-semibold capitalize",
                o.value === filters.type
                  ? "bg-pin-gray-900 text-white border-pin-gray-900"
                  : "border-hairline-strong text-muted-foreground",
              )}
            >
              {o.label}
            </Link>
          ))}
        </div>

        <p className="text-muted-foreground text-body-sm">
          {total} {tab === "devices" ? "devices available" : "open requests"}
          {hasFilters && (
            <>
              {" · "}
              <Link href={basePath} className="text-link hover:underline">
                Clear filters
              </Link>
            </>
          )}
        </p>

        {items.length === 0 ? (
          <div className="p-14 border border-hairline-strong border-dashed rounded-lg text-body-md text-muted-foreground text-center">
            {hasFilters ? "Nothing matches those filters. Try fewer filters, or post a" : "Nothing listed yet. Post a"}{" "}
            {tab === "devices" ? "request" : "listing"} so people nearby can
            see you.
          </div>
        ) : (
          <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tab === "devices"
              ? (items as ListingCardData[]).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))
              : (items as RequestCardData[]).map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
          </div>
        )}

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="flex justify-between items-center gap-3">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={browseHref(basePath, { ...filters, page: page - 1 })}>← Previous</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground text-body-sm">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Button asChild variant="outline">
                <Link href={browseHref(basePath, { ...filters, page: page + 1 })}>Next →</Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
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

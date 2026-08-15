"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { REQUESTS } from "@/data/marketplace-data";
import { Button } from "../ui/button";

const DashboardView = ({ firstName }: { firstName: string }) => {
  const [role, setRole] = useState<"donor" | "requester">("donor");
  const incoming = REQUESTS.slice(0, 3);

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
          <span className="text-heading-3">4.9 ★</span>
          <span className="text-muted-foreground text-body-sm">
            Your rating, 11 reviews
          </span>
        </div>
        <div className="flex flex-col gap-1 p-4 border rounded-lg">
          <span className="text-heading-3">6</span>
          <span className="text-muted-foreground text-body-sm">
            Completed handoffs
          </span>
        </div>
        <div className="flex flex-col gap-1 p-4 border rounded-lg">
          <span className="text-heading-3 text-pin-green-600">Verified</span>
          <span className="text-muted-foreground text-body-sm">
            NIN and ID confirmed
          </span>
        </div>
      </div>

      {role === "donor" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap justify-between items-baseline gap-3">
              <h2 className="text-heading-3">Incoming requests</h2>
              <span className="text-muted-foreground text-body-sm">
                3 people asked for your HP ProBook 450
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {incoming.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg"
                >
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex justify-center items-center bg-surface-feature rounded-full size-11 font-heading font-bold text-pin-green-600">
                        {r.person[0]}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-heading font-semibold text-heading-5">
                          {r.person}
                        </span>
                        <span className="text-muted-foreground text-body-sm">
                          {r.area}, {r.city} · asked {r.posted}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="badge badge-green">ID-verified</span>
                      <span className="badge badge-orange">
                        No-resale pledge signed
                      </span>
                    </div>
                  </div>
                  <p className="text-body-md text-pretty">
                    &ldquo;{r.note}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-3 pt-3 border-t">
                    <Button asChild variant="secondary">
                      <Link href="/messages/1">Choose {r.person}</Link>
                    </Button>
                    <Button variant="outline">Decline</Button>
                    <Button variant="link" className="text-destructive">
                      Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Your listings</h2>
            <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2 p-4 border rounded-lg">
                <span className="font-heading font-semibold text-heading-5">
                  HP ProBook 450
                </span>
                <span className="text-muted-foreground text-body-sm">
                  Wuse, Abuja · Fair · live for 4 days
                </span>
                <span className="self-start badge badge-orange">
                  3 requests waiting
                </span>
              </div>
              <div className="flex flex-col gap-2 p-4 border rounded-lg">
                <span className="font-heading font-semibold text-heading-5">
                  Samsung Galaxy A10
                </span>
                <span className="text-muted-foreground text-body-sm">
                  Wuse, Abuja · Good · handed over in June
                </span>
                <span className="self-start badge badge-green">
                  Completed · rated 5 ★
                </span>
              </div>
              <Link
                href="/listings/new"
                className="flex flex-col justify-center gap-1.5 p-4 border border-hairline-strong border-dashed rounded-lg min-h-27"
              >
                <span className="font-heading font-semibold text-heading-5 text-pin-green-600">
                  + List another device
                </span>
                <span className="text-muted-foreground text-body-sm">
                  Two minutes
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Requests you&apos;ve sent</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
                <div className="flex flex-col gap-1">
                  <span className="font-heading font-semibold text-heading-5">
                    Dell Latitude E7450 · Hauwa
                  </span>
                  <span className="text-muted-foreground text-body-sm">
                    Nassarawa, Kano · sent 2 days ago
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-green">
                    Chosen — chat open
                  </span>
                  <Button asChild variant="secondary">
                    <Link href="/messages/1">Open chat</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
                <div className="flex flex-col gap-1">
                  <span className="font-heading font-semibold text-heading-5">
                    Infinix Hot 10 · Ngozi
                  </span>
                  <span className="text-muted-foreground text-body-sm">
                    Independence Layout, Enugu · sent 6 days ago
                  </span>
                </div>
                <span className="text-muted-foreground text-body-sm">
                  Waiting on the donor
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-heading-3">Your open request</h2>
            <div className="flex flex-col gap-2 p-4 border rounded-lg">
              <span className="font-heading font-semibold text-heading-5">
                Laptop for my final-year project
              </span>
              <span className="text-muted-foreground text-body-sm">
                Any working condition · Nsukka, Enugu · seen by 41 donors
              </span>
              <Link
                href="/requests/new"
                className="self-start font-semibold text-body-sm text-link hover:underline"
              >
                Edit request
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;

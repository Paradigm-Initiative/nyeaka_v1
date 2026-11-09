import React from "react";
import Link from "next/link";
import { getRecentListings } from "@/lib/queries";
import ListingCard from "../listing-card";

const Listings = async () => {
  const listings = await getRecentListings(3);
  return (
    <section className="bg-canvas">
      <div className="flex flex-col gap-6 section-wrapper">
        <div className="flex flex-wrap justify-between items-baseline gap-3">
          <h2 className="text-heading-2">Listed in the last seven days</h2>
          <Link
            href="/listings"
            className="font-semibold text-body-sm text-link hover:underline"
          >
            See all listings
          </Link>
        </div>
        {listings.length === 0 && (
          <p className="text-muted-foreground text-body-md">
            No devices listed yet. Be the first to list one.
          </p>
        )}
        <div className="gap-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Listings;

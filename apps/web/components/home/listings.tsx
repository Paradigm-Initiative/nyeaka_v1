import React from "react";
import Link from "next/link";
import { getRecentListings } from "@/lib/queries";
import { getServerSession } from "@/lib/get-session";
import ListingCard from "../listing-card";
import { getTranslations } from "next-intl/server";

const Listings = async () => {
  const t = await getTranslations("home.listings");
  const session = await getServerSession();
  const listings = await getRecentListings(3, session?.user.id);
  return (
    <section className="bg-canvas">
      <div className="flex flex-col gap-6 section-wrapper">
        <div className="flex flex-wrap justify-between items-baseline gap-3">
          <h2 className="text-heading-2">{t("title")}</h2>
          <Link
            href="/listings"
            className="inline-flex items-center min-h-11 font-semibold text-body-sm text-link hover:underline"
          >
            {t("seeAll")}
          </Link>
        </div>
        {listings.length === 0 && (
          <p className="text-muted-foreground text-body-md">
            {t("empty")}
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

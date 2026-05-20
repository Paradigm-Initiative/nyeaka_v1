import ListingCard from "@/components/listing-card";
import { sampleListings } from "@/data/home-data";
import React from "react";

const Listings = () => {
  return (
    <div className="flex flex-col gap-4 mx-auto p-10 w-full container">
      <h2>Recently Listed Devices</h2>
      <div className="gap-6 grid md:grid-cols-2 lg:grid-cols-3">
        {sampleListings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </div>
  );
};

export default Listings;

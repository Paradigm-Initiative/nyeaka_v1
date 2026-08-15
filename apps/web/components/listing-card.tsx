import React from "react";
import Link from "next/link";
import DeviceTile from "./device-tile";
import { Card, CardContent, CardFooter } from "./ui/card";
import { MockListing } from "@/types/types";

const ListingCard = ({ listing }: { listing: MockListing }) => {
  const { id, kind, title, condition, city, area, posted } = listing;

  return (
    <Link href={`/listings/${id}`}>
      <Card className="gap-4 p-4">
        <DeviceTile kind={kind} className="h-33" />
        <CardContent className="flex flex-col gap-1 px-0">
          <h3 className="text-heading-5">{title}</h3>
          <p className="text-muted-foreground text-body-sm">
            {area}, {city} · {condition}
          </p>
        </CardContent>
        <CardFooter className="justify-between items-center px-0 pt-3 border-t">
          <span className="badge badge-green">ID-verified donor</span>
          <span className="text-muted-foreground text-caption-bold">
            {posted}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ListingCard;

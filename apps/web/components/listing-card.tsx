import React from "react";
import Link from "next/link";
import Image from "next/image";
import DeviceTile from "./device-tile";
import { Card, CardContent, CardFooter } from "./ui/card";
import type { ListingCardData } from "@/lib/queries";
import { conditionLabel } from "@/lib/device-options";
import { placeLabel, timeAgo } from "@/lib/format";

const ListingCard = ({ listing }: { listing: ListingCardData }) => {
  const { id, deviceType, title, condition, city, area, createdAt, donor, photos } = listing;

  return (
    <Link href={`/listings/${id}`}>
      <Card className="gap-4 p-4">
        {photos[0] ? (
          <div className="relative rounded-lg h-33 overflow-hidden">
            <Image src={photos[0]} alt={title} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
          </div>
        ) : (
          <DeviceTile kind={deviceType} className="h-33" />
        )}
        <CardContent className="flex flex-col gap-1 px-0">
          <h3 className="text-heading-5">{title}</h3>
          <p className="text-muted-foreground text-body-sm">
            {placeLabel(city, area)} · {conditionLabel(condition)}
          </p>
        </CardContent>
        <CardFooter className="justify-between items-center px-0 pt-3 border-t">
          {donor.idVerified ? (
            <span className="badge badge-green">ID-verified donor</span>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-caption-bold">
            {timeAgo(createdAt)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ListingCard;

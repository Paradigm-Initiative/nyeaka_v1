import React from "react";
import { Laptop, Smartphone, Tablet, MapPin } from "lucide-react";
import { cn, formatCondition } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardFooter,
  CardAction,
  CardContent,
} from "./ui/card";
import { ShortListing } from "@/types/types";
import Link from "next/link";

const ListingCard = ({
  id,
  condition,
  model,
  deviceType,
  country,
  ram,
  storage,
}: ShortListing) => {
  const deviceDiv = () => {
    switch (deviceType) {
      case "LAPTOP":
        return <Laptop className="size-6" />;
      case "SMARTPHONE":
        return <Smartphone className="size-6" />;
      case "TABLET":
        return <Tablet className="size-6" />;
      default:
        return null;
    }
  };

  return (
    <Card className="bg-blue-50 p-4">
      <CardHeader className="flex justify-between items-start">
        <span className="flex justify-center items-center bg-amber-200 p-2 rounded-lg size-10 text-black">
          {deviceDiv()}
        </span>
        <span className="flex justify-center items-center bg-amber-200 px-4 py-1 rounded-lg font-semibold text-black text-sm">
          {formatCondition(condition)}
        </span>
      </CardHeader>
      <CardContent>
        <h3>{model}</h3>
        <p>
          {ram}GB RAM / {storage}GB Storage
        </p>
      </CardContent>
      <CardFooter className="justify-between items-center border-t">
        <div className="flex items-center">
          <MapPin className="inline size-4" />
          <span className="ml-1 text-sm">{country}</span>
        </div>

        <Link href={`/listings/${id}`} className="hover:underline">
          <CardAction className={cn("text-primary text-sm")}>
            View Details
          </CardAction>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default ListingCard;

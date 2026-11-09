import React from "react";
import Link from "next/link";
import DeviceTile from "./device-tile";
import { Card, CardContent, CardFooter } from "./ui/card";
import type { RequestCardData } from "@/lib/queries";
import { conditionLabel } from "@/lib/device-options";
import { placeLabel, timeAgo } from "@/lib/format";

const RequestCard = ({ request }: { request: RequestCardData }) => {
  const { id, deviceType, title, minCondition, city, area, createdAt, requester } = request;

  return (
    <Link href={`/requests/${id}`}>
      <Card className="gap-4 p-4">
        <DeviceTile kind={deviceType ?? "OTHER"} className="h-33" />
        <CardContent className="flex flex-col gap-1 px-0">
          <h3 className="text-heading-5">{title}</h3>
          <p className="text-muted-foreground text-body-sm">
            {placeLabel(city, area)}
            {minCondition ? ` · ${conditionLabel(minCondition)} or better` : ""}
          </p>
        </CardContent>
        <CardFooter className="justify-between items-center px-0 pt-3 border-t">
          {requester.idVerified ? (
            <span className="badge badge-orange">ID-verified requester</span>
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

export default RequestCard;

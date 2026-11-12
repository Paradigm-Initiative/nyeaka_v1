import React from "react";
import Link from "next/link";
import DeviceTile from "./device-tile";
import { Card, CardContent, CardFooter } from "./ui/card";
import type { RequestCardData } from "@/lib/queries";
import { placeLabel } from "@/lib/format";
import { useFormatter, useTranslations } from "next-intl";

const RequestCard = ({ request }: { request: RequestCardData }) => {
  const t = useTranslations("card");
  const tDevice = useTranslations("device");
  const format = useFormatter();
  const { id, deviceType, title, minCondition, city, area, createdAt, requester } = request;

  return (
    <Link href={`/requests/${id}`}>
      <Card className="gap-4 p-4">
        <DeviceTile kind={deviceType ?? "OTHER"} className="h-33" />
        <CardContent className="flex flex-col gap-1 px-0">
          <h3 className="text-heading-5">{title}</h3>
          <p className="text-muted-foreground text-body-sm">
            {placeLabel(city, area)}
            {minCondition ? ` · ${t("orBetter", { condition: tDevice(`condition.${minCondition}`) })}` : ""}
          </p>
        </CardContent>
        <CardFooter className="justify-between items-center px-0 pt-3 border-t">
          {requester.idVerified ? (
            <span className="badge badge-orange">{t("verifiedRequester")}</span>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-caption-bold">
            {format.relativeTime(createdAt)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default RequestCard;

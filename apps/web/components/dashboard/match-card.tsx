"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import ReportPanel from "../safety/report-panel";
import { cancelMatchAction } from "@/actions/matchings";
import type { DashboardMatch } from "@/lib/queries";
import { useFormatter, useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

const MatchCard = ({ match: m }: { match: DashboardMatch }) => {
  const t = useTranslations("matchCard");
  const errText = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const cancel = () =>
    start(async () => {
      const res = await cancelMatchAction(m.id);
      if (!res.ok) {
        toast.error(errText(res.error));
        router.refresh();
        return;
      }
      toast.success(t("cancelled"));
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex flex-col gap-0.5">
        <span className="font-heading font-semibold text-heading-5">
          {t("title", { title: m.listingTitle, name: m.otherFirstName })}
        </span>
        <span className="text-muted-foreground text-body-sm">
          {t("meta", { request: m.requestTitle, time: format.relativeTime(m.createdAt) })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {m.conversationId && (
          <Button asChild size="sm">
            <Link href={`/messages/${m.conversationId}`}>{t("openChat")}</Link>
          </Button>
        )}
        {confirming ? (
          <>
            <span className="text-body-sm">{t("confirm")}</span>
            <Button size="sm" variant="destructive" disabled={pending} onClick={cancel}>
              {pending ? t("cancelling") : t("yesCancel")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {t("keep")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
            {t("cancel")}
          </Button>
        )}
        <ReportPanel targetType="USER" targetId={m.otherId} who={m.otherFirstName} />
      </div>
    </div>
  );
};

export default MatchCard;

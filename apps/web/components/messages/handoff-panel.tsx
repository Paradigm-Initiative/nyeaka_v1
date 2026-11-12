"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import RatingForm from "./rating-form";
import { confirmHandoffAction } from "@/actions/lifecycle";
import type { Thread } from "@/lib/messages";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

/** Handoff confirmation while the match is live, then the rating form once it has ended. */
const HandoffPanel = ({ thread }: { thread: Thread }) => {
  const t = useTranslations("handoff");
  const errText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const who = thread.other.firstName;
  const { handoff, matchStatus } = thread;

  const confirm = () =>
    start(async () => {
      const res = await confirmHandoffAction(thread.matchId);
      if (!res.ok) {
        toast.error(errText(res.error));
        router.refresh();
        return;
      }
      toast.success(res.data.handedOver ? t("complete") : t("confirmed"));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 pt-4 border-t">
      {matchStatus === "ACTIVE" && (
        <div className="flex flex-wrap justify-between items-center gap-3">
          <p className="max-w-[46ch] text-muted-foreground text-body-sm">
            {handoff.iConfirmed
              ? t("waiting", { who })
              : handoff.theyConfirmed
                ? t("theyConfirmed", { who })
                : t("prompt")}
          </p>
          {!handoff.iConfirmed && (
            <Button disabled={pending} onClick={confirm}>
              {pending ? t("confirming") : t("confirm")}
            </Button>
          )}
        </div>
      )}
      {matchStatus === "HANDED_OVER" && (
        <span className="text-heading-4">{t("both")}</span>
      )}
      {matchStatus !== "ACTIVE" && (
        <RatingForm
          matchId={thread.matchId}
          who={who}
          rating={thread.rating}
          cancelled={matchStatus === "CANCELLED"}
        />
      )}
    </div>
  );
};

export default HandoffPanel;

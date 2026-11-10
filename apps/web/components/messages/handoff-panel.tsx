"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import RatingForm from "./rating-form";
import { confirmHandoffAction } from "@/actions/lifecycle";
import type { Thread } from "@/lib/messages";

/** Handoff confirmation while the match is live, then the rating form once it has ended. */
const HandoffPanel = ({ thread }: { thread: Thread }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const who = thread.other.firstName;
  const { handoff, matchStatus } = thread;

  const confirm = () =>
    start(async () => {
      const res = await confirmHandoffAction(thread.matchId);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(res.data.handedOver ? "Handoff complete" : "Handoff confirmed");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 pt-4 border-t">
      {matchStatus === "ACTIVE" && (
        <div className="flex flex-wrap justify-between items-center gap-3">
          <p className="max-w-[46ch] text-muted-foreground text-body-sm">
            {handoff.iConfirmed
              ? `You've confirmed. Waiting for ${who} to confirm too.`
              : handoff.theyConfirmed
                ? `${who} has confirmed the handoff. Once the device has changed hands, confirm here.`
                : "Once the device has changed hands, you both confirm here. Ratings open after that."}
          </p>
          {!handoff.iConfirmed && (
            <Button disabled={pending} onClick={confirm}>
              {pending ? "Confirming…" : "Confirm handoff"}
            </Button>
          )}
        </div>
      )}
      {matchStatus === "HANDED_OVER" && (
        <span className="text-heading-4">Both of you confirmed the handoff</span>
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

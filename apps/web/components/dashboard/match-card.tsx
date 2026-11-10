"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { cancelMatchAction } from "@/actions/matchings";
import type { DashboardMatch } from "@/lib/queries";
import { timeAgo } from "@/lib/format";

const MatchCard = ({ match: m }: { match: DashboardMatch }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const cancel = () =>
    start(async () => {
      const res = await cancelMatchAction(m.id);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success("Match cancelled. Your post is live again.");
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg">
      <div className="flex flex-col gap-0.5">
        <span className="font-heading font-semibold text-heading-5">
          {m.listingTitle} · with {m.otherFirstName}
        </span>
        <span className="text-muted-foreground text-body-sm">
          For &ldquo;{m.requestTitle}&rdquo; · matched {timeAgo(m.createdAt)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {m.conversationId && (
          <Button asChild size="sm">
            <Link href={`/messages/${m.conversationId}`}>Open chat</Link>
          </Button>
        )}
        {confirming ? (
          <>
            <span className="text-body-sm">Cancel this match?</span>
            <Button size="sm" variant="destructive" disabled={pending} onClick={cancel}>
              {pending ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
            Cancel match
          </Button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;

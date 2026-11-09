"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { closeListingAction, renewListingAction } from "@/actions/listings";
import { closeRequestAction, renewRequestAction } from "@/actions/requests";
import type { PostState } from "@/lib/lifecycle";

const ACTIONS = {
  listing: { close: closeListingAction, renew: renewListingAction, base: "/listings" },
  request: { close: closeRequestAction, renew: renewRequestAction, base: "/requests" },
} as const;

/** Owner-only controls: edit and close while live, renew once closed or expired. */
const PostActions = ({
  kind,
  id,
  state,
}: {
  kind: "listing" | "request";
  id: string;
  state: PostState;
}) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const a = ACTIONS[kind];

  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn(id);
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      toast.success(done);
      setConfirming(false);
      router.refresh();
    });

  if (state === "MATCHED") return null;

  if (state === "EXPIRED" || state === "CLOSED") {
    return (
      <Button size="sm" disabled={pending} onClick={() => run(a.renew, "Renewed for 60 days")}>
        {pending ? "Renewing…" : state === "CLOSED" ? "Reopen for 60 days" : "Renew for 60 days"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href={`${a.base}/${id}/edit`}>Edit</Link>
      </Button>
      {confirming ? (
        <>
          <span className="text-body-sm">Close this {kind}?</span>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(a.close, `${kind[0].toUpperCase()}${kind.slice(1)} closed`)}>
            {pending ? "Closing…" : "Yes, close it"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Close
        </Button>
      )}
    </div>
  );
};

export default PostActions;

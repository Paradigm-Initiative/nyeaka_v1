"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { blockUserAction } from "@/actions/safety";

const BlockButton = ({ userId, who }: { userId: string; who: string }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
        Block
      </Button>
    );

  return (
    <div className="flex flex-col gap-2 bg-pin-orange-100 p-3 rounded-lg max-w-sm">
      <p className="text-body-sm">
        Block {who}? You won&rsquo;t be able to message or offer to each other, you&rsquo;ll stop seeing each
        other&rsquo;s posts, and any open match between you is cancelled. They are not told.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await blockUserAction(userId);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(`${who} blocked`);
              setConfirming(false);
              router.refresh();
            })
          }
        >
          {pending ? "Blocking…" : "Yes, block"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default BlockButton;

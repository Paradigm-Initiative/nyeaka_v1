"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { unblockUserAction } from "@/actions/safety";

const UnblockButton = ({ userId, who }: { userId: string; who: string }) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await unblockUserAction(userId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(`${who} unblocked`);
          router.refresh();
        })
      }
    >
      {pending ? "Unblocking…" : "Unblock"}
    </Button>
  );
};

export default UnblockButton;

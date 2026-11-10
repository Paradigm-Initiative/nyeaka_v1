"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { withdrawOfferAction } from "@/actions/offers";

const WithdrawButton = ({ offerId, label = "Withdraw offer" }: { offerId: string; label?: string }) => {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await withdrawOfferAction(offerId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Offer withdrawn");
          router.refresh();
        })
      }
    >
      {pending ? "Withdrawing…" : label}
    </Button>
  );
};

export default WithdrawButton;

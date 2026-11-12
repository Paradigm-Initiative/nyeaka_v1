"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { withdrawOfferAction } from "@/actions/offers";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

const WithdrawButton = ({ offerId, label }: { offerId: string; label?: string }) => {
  const t = useTranslations("withdraw");
  const errText = useErrorText();
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
            toast.error(errText(res.error));
            return;
          }
          toast.success(t("done"));
          router.refresh();
        })
      }
    >
      {pending ? t("pending") : (label ?? t("label"))}
    </Button>
  );
};

export default WithdrawButton;

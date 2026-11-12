"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { blockUserAction } from "@/actions/safety";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

const BlockButton = ({ userId, who }: { userId: string; who: string }) => {
  const t = useTranslations("safety");
  const errText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
        {t("block")}
      </Button>
    );

  return (
    <div className="flex flex-col gap-2 bg-pin-orange-100 p-3 rounded-lg max-w-sm">
      <p className="text-body-sm">
        {t("blockConfirm", { who })}
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
                toast.error(errText(res.error));
                return;
              }
              toast.success(t("blocked", { who }));
              setConfirming(false);
              router.refresh();
            })
          }
        >
          {pending ? t("blocking") : t("yesBlock")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
};

export default BlockButton;

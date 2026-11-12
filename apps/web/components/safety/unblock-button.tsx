"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { unblockUserAction } from "@/actions/safety";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

const UnblockButton = ({ userId, who }: { userId: string; who: string }) => {
  const t = useTranslations("safety");
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
          const res = await unblockUserAction(userId);
          if (!res.ok) {
            toast.error(errText(res.error));
            return;
          }
          toast.success(t("unblocked", { who }));
          router.refresh();
        })
      }
    >
      {pending ? t("unblocking") : t("unblock")}
    </Button>
  );
};

export default UnblockButton;

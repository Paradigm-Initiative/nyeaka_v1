"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useTranslations } from "next-intl";

const VerifyForm = () => {
  const t = useTranslations("verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsId = searchParams.get("level") === "2";

  const heading = t(needsId ? "headingList" : "headingRequest");
  const reason = t(needsId ? "reasonList" : "reasonRequest");

  const finish = () => {
    toast.success(t("submitted"));
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col gap-5 mx-auto py-8 max-w-2xl">
      <h1 className="text-heading-2 text-pretty">{heading}</h1>
      <p className="text-muted-foreground text-body-lg text-pretty">
        {reason}
      </p>

      <div className="flex flex-col gap-4 p-4 border rounded-lg">
        <div className="flex items-start gap-3">
          <span className="flex flex-none justify-center items-center bg-surface-feature rounded-full size-7 font-heading font-bold text-pin-green-600 text-sm">
            ✓
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-6">
              {t("phoneConfirmed")}
            </span>
            <span className="text-muted-foreground text-body-sm">
              {t("phoneDone")}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex flex-none justify-center items-center bg-pin-green-600 rounded-full size-7 font-heading font-bold text-white text-sm">
            2
          </span>
          <div className="flex flex-col flex-1 gap-1.5">
            <span className="font-heading font-semibold text-heading-6">
              {t("ninTitle")}
            </span>
            <span className="text-muted-foreground text-body-sm">
              {t("ninBody")}
            </span>
            <Input placeholder={t("ninPlaceholder")} className="mt-1 h-13 rounded-sm" />
          </div>
        </div>

        {needsId && (
          <div className="flex items-start gap-3">
            <span className="flex flex-none justify-center items-center bg-pin-green-600 rounded-full size-7 font-heading font-bold text-white text-sm">
              3
            </span>
            <div className="flex flex-col flex-1 gap-2">
              <span className="font-heading font-semibold text-heading-6">
                {t("photoTitle")}
              </span>
              <span className="text-muted-foreground text-body-sm">
                {t("photoBody")}
              </span>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-1 justify-center items-center border border-hairline-strong border-dashed rounded-sm min-w-35 h-24 text-muted-foreground text-body-sm">
                  {t("idPhoto")}
                </div>
                <div className="flex flex-1 justify-center items-center border border-hairline-strong border-dashed rounded-sm min-w-35 h-24 text-muted-foreground text-body-sm">
                  {t("selfie")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface-feature p-4 rounded-lg text-body-sm">
        {t("note")}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={finish}>
          {t("submit")}
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/listings">{t("keepBrowsing")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default VerifyForm;

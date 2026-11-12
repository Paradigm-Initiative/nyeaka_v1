import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { getTranslations } from "next-intl/server";

const CtaBanner = async () => {
  const t = await getTranslations("home.cta");
  return (
    <section className="bg-canvas">
      <div className="section-wrapper">
        <div className="flex flex-wrap justify-between items-center gap-6 p-8 md:p-10 card-sticker">
          <div className="flex flex-col gap-2 max-w-[52ch]">
            <span className="text-pin-orange-700 text-micro-uppercase">
              {t("eyebrow")}
            </span>
            <h2 className="text-heading-3">
              {t("title")}
            </h2>
            <p className="text-body-md text-muted-foreground">
              {t("body")}
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/listings/new">{t("button")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CtaBanner;

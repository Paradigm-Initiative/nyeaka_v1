import React from "react";
import { trustPointIds } from "@/data/home-data";
import { getTranslations } from "next-intl/server";

const TrustSection = async () => {
  const t = await getTranslations("home.trust");
  return (
    <section className="bg-surface-feature">
      <div className="gap-8 grid grid-cols-1 sm:grid-cols-3 section-wrapper">
        {trustPointIds.map((id) => (
          <div key={id} className="flex flex-col gap-2">
            <h3 className="text-heading-5">{t(`${id}.title`)}</h3>
            <p className="text-muted-foreground text-body-md">
              {t(`${id}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustSection;

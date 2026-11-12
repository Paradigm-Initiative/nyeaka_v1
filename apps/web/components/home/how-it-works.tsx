import React from "react";
import { howItWorksIds } from "../../data/home-data";
import { getTranslations } from "next-intl/server";
import HIWItem from "./how-it-works-item";

const HowItWorks = async () => {
  const t = await getTranslations("home.how");
  return (
    <section id="how-it-works" className="bg-canvas scroll-mt-20">
      <div className="flex flex-col gap-6 section-wrapper">
        <h2 className="text-heading-2">{t("title")}</h2>
        <div className="gap-8 grid grid-cols-1 sm:grid-cols-3">
          {howItWorksIds.map((id) => (
            <HIWItem
              key={id}
              eyebrow={t(`steps.${id}.eyebrow`)}
              title={t(`steps.${id}.title`)}
              description={t(`steps.${id}.description`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

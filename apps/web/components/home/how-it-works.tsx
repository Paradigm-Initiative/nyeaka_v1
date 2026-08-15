import React from "react";
import { howItWorksData } from "../../data/home-data";
import HIWItem from "./how-it-works-item";

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-canvas scroll-mt-20">
      <div className="flex flex-col gap-6 section-wrapper">
        <h2 className="text-heading-2">How it works</h2>
        <div className="gap-8 grid grid-cols-1 sm:grid-cols-3">
          {howItWorksData.map(({ id, eyebrow, title, description }) => (
            <HIWItem
              key={id}
              eyebrow={eyebrow}
              title={title}
              description={description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

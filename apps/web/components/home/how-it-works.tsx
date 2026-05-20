import React from "react";
import { howItWorksData } from "../../data/home-data";
import HIWItem from "./how-it-works-item";

const HowItWorks = () => {
  const { forRequesters, forDonors } = howItWorksData;
  return (
    <section className="flex flex-col justify-center items-center gap-5 bg-muted mx-auto my-10 p-10 border-2 border-accent-foreground rounded-4xl container">
      <h2 className="font-bold text-primary text-2xl">How it works</h2>
      <div className="gap-12 lg:gap-24 grid md:grid-cols-2">
        <div>
          <h3 className="mb-4 border-b border-outline-variant text-primary">
            For Requesters
          </h3>
          <ul className="space-y-4">
            {forRequesters.map(({ id, title, description }) => (
              <HIWItem
                key={id}
                id={id}
                title={title}
                description={description}
              />
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 border-b border-outline-variant">For Donors</h3>
          <ul className="space-y-4">
            {forDonors.map(({ id, title, description }) => (
              <HIWItem
                key={id}
                id={id}
                title={title}
                description={description}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

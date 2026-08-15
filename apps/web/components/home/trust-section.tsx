import React from "react";
import { trustPoints } from "@/data/home-data";

const TrustSection = () => {
  return (
    <section className="bg-surface-feature">
      <div className="gap-8 grid grid-cols-1 sm:grid-cols-3 section-wrapper">
        {trustPoints.map((point) => (
          <div key={point.id} className="flex flex-col gap-2">
            <h3 className="text-heading-5">{point.title}</h3>
            <p className="text-muted-foreground text-body-md">
              {point.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustSection;

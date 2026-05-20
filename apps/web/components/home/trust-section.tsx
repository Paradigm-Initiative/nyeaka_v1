import React from "react";
import { cardDetails } from "@/data/home-data";
import { Card, CardHeader, CardContent } from "../ui/card";
import { cn } from "@/lib/utils";

const TrustSection = () => {
  return (
    <section>
      <div className="mx-auto px-4 py-12 container">
        <h2 className="mb-8 font-bold text-3xl text-center">Why Trust Us?</h2>
        <div className="gap-8 grid grid-cols-1 md:grid-cols-3">
          {cardDetails.map((card) => (
            <Card
              key={card.id}
              className="flex flex-col bg-white shadow-md p-6 border-2 border-amber-600 rounded-lg text-center"
            >
              <CardHeader className="flex justify-center">
                <div
                  className={cn(
                    "flex justify-center items-center rounded-full w-16 h-16",
                    card.bgColor,
                  )}
                >
                  {card.icon}
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <h3 className="mb-2 font-semibold text-xl">{card.title}</h3>
                <p className="text-gray-600">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;

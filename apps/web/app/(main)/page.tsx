import Hero from "@/components/home/hero";
import HowItWorks from "@/components/home/how-it-works";
import TrustSection from "@/components/home/trust-section";
import React from "react";
import Listings from "./listings/page";

const HomePage = () => {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Listings />
      <div>recent requests</div>
      <TrustSection />
    </>
  );
};

export default HomePage;

import Hero from "@/components/home/hero";
import HowItWorks from "@/components/home/how-it-works";
import Listings from "@/components/home/listings";
import TrustSection from "@/components/home/trust-section";
import CtaBanner from "@/components/home/cta-banner";

const HomePage = () => {
  return (
    <div className="flex flex-col">
      <Hero />
      <HowItWorks />
      <Listings />
      <TrustSection />
      <CtaBanner />
    </div>
  );
};

export default HomePage;

import Link from "next/link";
import { Button } from "../ui/button";
import OrganicEdge from "../layout/organic-edge";
import { getFormatter, getTranslations } from "next-intl/server";

const Hero = async () => {
  const t = await getTranslations("home.hero");
  const format = await getFormatter();
  const devicesRehomed = 1000; // Replace with the actual count of devices rehomed
  const verifiedMembers = 940; // Replace with the actual count of ID-verified members
  const citiesCovered = 10; // Replace with the actual count of cities covered

  return (
    <section className="flex flex-col">
      <div className="flex justify-center items-center bg-canvas-dark min-h-150 text-pin-gray-50">
      <div className="items-center gap-12 grid grid-cols-1 md:grid-cols-2 section-wrapper">
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex items-center gap-2 text-pin-orange-400 text-micro-uppercase">
            <span className="bg-pin-orange-500 rounded-full size-2" />
            {t("badge", { count: devicesRehomed })}
          </span>
          <h1 className="text-hero-display text-pretty">
            {t("title")}
          </h1>
          <p className="max-w-[48ch] text-pin-gray-400 text-subtitle">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Button size="lg" asChild>
              <Link href="/listings/new">{t("give")}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent hover:bg-white/10 border-white/30 hover:border-white/50 text-pin-gray-50 hover:text-pin-gray-50"
              asChild
            >
              <Link href="/requests/new">{t("need")}</Link>
            </Button>
          </div>
          <p className="mt-2 text-body-sm text-pin-gray-500">
            {t("disclaimer")}
          </p>
        </div>

        <div className="flex flex-col gap-4 bg-white/6 backdrop-blur-sm p-6 border border-white/12 rounded-lg">
          <span className="text-pin-gray-500 text-micro-uppercase">
            {t("statsTitle")}
          </span>
          <div className="flex justify-between items-baseline gap-4 pb-2.5 border-white/12 border-b">
            <span className="text-heading-3 text-pin-orange-400">
              {format.number(devicesRehomed)}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              {t("statDevices")}
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-4 pb-2.5 border-white/12 border-b">
            <span className="text-heading-3 text-pin-orange-400">
              {format.number(verifiedMembers)}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              {t("statMembers")}
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-heading-3 text-pin-orange-400">
              {format.number(citiesCovered)}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              {t("statCities")}
            </span>
          </div>
          <p className="text-body-sm text-pin-gray-500">
            {t("statsNote")}
          </p>
        </div>
      </div>
      </div>
      <OrganicEdge />
    </section>
  );
};

export default Hero;

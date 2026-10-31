import Link from "next/link";
import { Button } from "../ui/button";
import OrganicEdge from "../layout/organic-edge";

const Hero = () => {
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
            {devicesRehomed.toLocaleString()} devices rehomed since launch
          </span>
          <h1 className="text-hero-display text-pretty">
            The laptop you stopped using still works.
          </h1>
          <p className="max-w-[48ch] text-pin-gray-400 text-subtitle">
            Every one of those devices was sitting unused in a Nigerian home
            until somebody listed it. Nyeaka is free, has no middlemen and takes
            no cut — members are ID-verified, then they meet and hand over
            themselves.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Button size="lg" asChild>
              <Link href="/listings/new">I have a device to give</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent hover:bg-white/10 border-white/30 hover:border-white/50 text-pin-gray-50 hover:text-pin-gray-50"
              asChild
            >
              <Link href="/requests/new">I need a device</Link>
            </Button>
          </div>
          <p className="mt-2 text-body-sm text-pin-gray-500">
            Nyeaka never handles the device, the meetup, or money — there is
            none.
          </p>
        </div>

        <div className="flex flex-col gap-4 bg-white/6 backdrop-blur-sm p-6 border border-white/12 rounded-lg">
          <span className="text-pin-gray-500 text-micro-uppercase">
            Since launch
          </span>
          <div className="flex justify-between items-baseline gap-4 pb-2.5 border-white/12 border-b">
            <span className="text-heading-3 text-pin-orange-400">
              {devicesRehomed.toLocaleString()}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              devices handed over
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-4 pb-2.5 border-white/12 border-b">
            <span className="text-heading-3 text-pin-orange-400">
              {verifiedMembers.toLocaleString()}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              ID-verified members
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-heading-3 text-pin-orange-400">
              {citiesCovered}
            </span>
            <span className="text-body-sm text-pin-gray-400 text-right">
              cities, Lagos to Uyo
            </span>
          </div>
          <p className="text-body-sm text-pin-gray-500">
            Roughly two in three listings are claimed within a week. Phones move
            fastest; laptops travel furthest.
          </p>
        </div>
      </div>
      </div>
      <OrganicEdge />
    </section>
  );
};

export default Hero;

import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";

const CtaBanner = () => {
  return (
    <section className="bg-canvas-dark">
      <div className="flex flex-wrap justify-between items-center gap-4 section-wrapper">
        <div className="flex flex-col gap-2 max-w-[52ch]">
          <h2 className="text-heading-3 text-pin-gray-50">
            Somebody near you is waiting on a device you already own.
          </h2>
          <p className="text-body-md text-pin-gray-400">
            Listing takes about two minutes. You choose who receives it.
          </p>
        </div>
        <Button variant="secondary" size="lg" asChild>
          <Link href="/listings/new">List a device</Link>
        </Button>
      </div>
    </section>
  );
};

export default CtaBanner;

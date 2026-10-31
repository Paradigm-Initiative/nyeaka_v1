import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";

const CtaBanner = () => {
  return (
    <section className="bg-canvas">
      <div className="section-wrapper">
        <div className="flex flex-wrap justify-between items-center gap-6 p-8 md:p-10 card-sticker">
          <div className="flex flex-col gap-2 max-w-[52ch]">
            <span className="text-pin-orange-700 text-micro-uppercase">
              Digital Inclusion
            </span>
            <h2 className="text-heading-3">
              Somebody near you is waiting on a device you already own.
            </h2>
            <p className="text-body-md text-muted-foreground">
              Listing takes about two minutes. You choose who receives it.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/listings/new">List a device</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CtaBanner;

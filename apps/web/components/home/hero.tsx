import React from "react";
import { Button } from "../ui/button";
import Link from "next/link";

const Hero = () => {
  return (
    <section className="bg-red-200">
      <div className="flex flex-col justify-center items-center mx-auto px-4 py-12 h-full text-center container">
        <div>
          <h1 className="mb-4 font-bold text-4xl">Welcome to Nyeaka</h1>
          <p className="mb-6 text-gray-600 text-lg">
            Pass on your working laptops, tablets, and smartphones to students
            and job seekers in under-served communities.
          </p>
        </div>
        <div className="flex justify-center items-center gap-4">
          <Button size="lg" asChild>
            <Link href="/listings">I need a device</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/requests">I have a device to donate</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;

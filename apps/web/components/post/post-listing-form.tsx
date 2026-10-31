"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DEVICE_CONDITIONS, DEVICE_KINDS, LISTING_EXTRAS } from "@/data/marketplace-data";
import { DeviceCondition, DeviceKind } from "@/types/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import ChipPicker from "./chip-picker";

const PostListingForm = () => {
  const [kind, setKind] = useState<DeviceKind>("phone");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<DeviceCondition>("Good");
  const [extras, setExtras] = useState<string[]>(["Charger"]);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [published, setPublished] = useState(false);

  const toggleExtra = (extra: string) => {
    setExtras((prev) =>
      prev.includes(extra) ? prev.filter((e) => e !== extra) : [...prev, extra],
    );
  };

  if (published) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">Published</span>
        <h1 className="text-heading-2">Your listing is live</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          Requests will arrive with a short note explaining the need. Read
          them, pick the one you want, and the chat opens. You are never
          obliged to give it to anyone.
        </p>
        <Button asChild>
          <Link href="/dashboard">See my dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPublished(true);
      }}
      className="flex flex-col gap-5 mx-auto py-8 max-w-2xl"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-2">List a device</h1>
        <p className="text-muted-foreground text-body-md">
          Be honest about the condition — a phone described accurately is
          claimed faster than one oversold.
        </p>
      </div>

      <ChipPicker
        label="What is it?"
        options={DEVICE_KINDS}
        value={kind}
        onChange={(v) => setKind(v as DeviceKind)}
        capitalize
      />

      <div className="flex flex-col gap-1.5">
        <label className="field-label">Brand and model</label>
        <Input
          required
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Tecno Spark 8"
          className="h-13.5 rounded-sm"
        />
      </div>

      <ChipPicker
        label="Condition"
        options={DEVICE_CONDITIONS}
        value={condition}
        onChange={(v) => setCondition(v as DeviceCondition)}
      />

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">
          Photos
        </span>
        <div className="gap-3 grid grid-cols-2 sm:grid-cols-3">
          <div className="flex flex-col justify-center items-center gap-1 border border-hairline-strong border-dashed rounded-sm h-28 text-muted-foreground text-body-sm cursor-pointer">
            <span className="text-pin-green-600 text-xl">+</span>
            <span>Add photo</span>
          </div>
          <div className="flex justify-center items-center border border-hairline-strong border-dashed rounded-sm h-28 text-muted-foreground text-body-sm">
            Screen on
          </div>
          <div className="flex justify-center items-center border border-hairline-strong border-dashed rounded-sm h-28 text-muted-foreground text-body-sm">
            Any damage
          </div>
        </div>
        <span className="text-muted-foreground text-body-sm">
          Three photos is plenty. Photograph the damage too — it saves a
          wasted trip for both of you.
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">
          Comes with
        </span>
        <div className="flex flex-wrap gap-2.5">
          {LISTING_EXTRAS.map((extra) => {
            const on = extras.includes(extra);
            return (
              <button
                key={extra}
                type="button"
                onClick={() => toggleExtra(extra)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-sm border px-4.5 py-3 font-heading text-sm font-semibold",
                  on
                    ? "bg-surface-feature border-pin-green-600"
                    : "border-hairline-strong",
                )}
              >
                <span className="w-3 text-pin-green-600">{on ? "✓" : ""}</span>
                {extra}
              </button>
            );
          })}
        </div>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="field-label">City</label>
          <Input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Lagos"
            className="h-13.5 rounded-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Area</label>
          <Input
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Yaba"
            className="h-13.5 rounded-sm"
          />
        </div>
      </div>

      <div className="bg-pin-orange-100 p-4 rounded-lg text-body-sm">
        Only your area shows publicly — never your street or house number.
        You choose the meeting place later, in the chat.
      </div>

      <Button type="submit" size="lg" className="self-start">
        Publish listing
      </Button>
    </form>
  );
};

export default PostListingForm;

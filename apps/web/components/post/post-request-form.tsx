"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DEVICE_CONDITIONS, DEVICE_KINDS } from "@/data/marketplace-data";
import { DeviceCondition, DeviceKind } from "@/types/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import ChipPicker from "./chip-picker";

const PostRequestForm = () => {
  const [kind, setKind] = useState<DeviceKind>("phone");
  const [condition, setCondition] = useState<DeviceCondition>("Good");
  const [note, setNote] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [pledge, setPledge] = useState(false);
  const [posted, setPosted] = useState(false);

  if (posted) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">Published</span>
        <h1 className="text-heading-2">Your request is live</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          Donors in your area can see it now, and you&apos;ll get an SMS if
          one offers you a device. Keep browsing listings in the meantime —
          asking directly often works faster.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/listings">Browse devices</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">My dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPosted(true);
      }}
      className="flex flex-col gap-5 mx-auto py-8 max-w-2xl"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-2">Ask for a device</h1>
        <p className="text-muted-foreground text-body-md">
          Donors read requests before they choose. Plain and specific works
          better than urgent.
        </p>
      </div>

      <ChipPicker
        label="What do you need?"
        options={DEVICE_KINDS}
        value={kind}
        onChange={(v) => setKind(v as DeviceKind)}
        capitalize
      />

      <ChipPicker
        label="Lowest condition you can work with"
        options={DEVICE_CONDITIONS}
        value={condition}
        onChange={(v) => setCondition(v as DeviceCondition)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="font-heading font-semibold text-heading-6">
          Why do you need it?
        </span>
        <Textarea
          required
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What it's for — school, work, your business — and what you're managing without it now."
          className="min-h-30 rounded-sm"
        />
        <span className="text-caption-bold text-pin-gray-400">
          {note.length}/280
        </span>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="field-label">City</label>
          <Input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enugu"
            className="h-13.5 rounded-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Area</label>
          <Input
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Nsukka"
            className="h-13.5 rounded-sm"
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-muted-foreground text-body-sm">
        <input
          type="checkbox"
          required
          checked={pledge}
          onChange={(e) => setPledge(e.target.checked)}
          className="accent-pin-green-600 mt-0.5 size-4.5"
        />
        <span>
          I am asking for my own use and will not resell it. This pledge
          appears on my request, and breaking it removes my account.
        </span>
      </label>

      <Button type="submit" size="lg" className="self-start">
        Post request
      </Button>
    </form>
  );
};

export default PostRequestForm;

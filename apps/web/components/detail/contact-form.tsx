"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const ContactForm = ({
  mode,
  who,
}: {
  mode: "request" | "offer";
  who: string;
}) => {
  const { data: session, isPending } = useSession();
  const [note, setNote] = useState("");
  const [pledge, setPledge] = useState(false);
  const [sent, setSent] = useState(false);

  if (isPending) return null;

  if (!session) {
    return (
      <div className="flex flex-wrap justify-between items-center gap-3 bg-pin-orange-100 p-4 rounded-lg">
        <p className="max-w-[46ch] text-body-sm">
          Create a free account to{" "}
          {mode === "request" ? "send a request" : "offer a device"} to{" "}
          {who}.
        </p>
        <Button asChild variant="secondary">
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 bg-surface-feature p-4 rounded-lg">
        <span className="badge badge-green">
          {mode === "request" ? "Request sent" : "Offer sent"}
        </span>
        <p className="text-body-md">
          {mode === "request"
            ? `${who} usually replies within two days. If they choose you, a chat opens here.`
            : `If it's what ${who} needs, they accept and a chat opens here — you can agree a public place to meet.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard">Go to my dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/listings">Keep browsing</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="flex flex-col gap-3"
    >
      <span className="font-heading font-semibold text-heading-6">
        {mode === "request"
          ? `Tell ${who} why you need it`
          : `Offer ${who} a device`}
      </span>
      <Textarea
        required
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          mode === "request"
            ? "A short note — what it's for, and when you could collect it. Donors read these before choosing."
            : "Say what you have and its condition — model, age, anything wrong with it. Be honest; it saves you both a trip."
        }
        className="min-h-26 rounded-sm"
      />
      {mode === "request" ? (
        <label className="flex items-start gap-2.5 text-muted-foreground text-body-sm">
          <input
            type="checkbox"
            required
            checked={pledge}
            onChange={(e) => setPledge(e.target.checked)}
            className="accent-pin-green-600 mt-0.5 size-4.5"
          />
          <span>
            I am asking for this device for my own use and I will not resell
            it. {who} can see this pledge on my request.
          </span>
        </label>
      ) : (
        <div className="bg-surface-feature p-3 rounded-lg text-body-sm">
          {who} has signed the no-resale pledge and verified their NIN. If
          they accept your offer, a chat opens and you agree a public place
          to meet.
        </div>
      )}
      <Button type="submit" variant="secondary" className="self-start">
        {mode === "request" ? "Send request" : "Offer a device"}
      </Button>
    </form>
  );
};

export default ContactForm;

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MOCK_CHAT_THREAD } from "@/data/marketplace-data";
import { ChatMessage } from "@/types/types";
import { Button } from "../ui/button";

const ChatThread = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_THREAD);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: "me", text, time: "now" }]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4 mx-auto py-6 max-w-3xl section-wrapper">
      <Link
        href="/dashboard"
        className="self-start font-semibold text-body-sm text-link hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b">
        <div className="flex items-center gap-3">
          <span className="flex justify-center items-center bg-surface-feature rounded-full size-11 font-heading font-bold text-pin-green-600">
            C
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-5">
              Chika · about HP ProBook 450
            </span>
            <span className="text-muted-foreground text-body-sm">
              ID-verified · 4.9 ★ · Nsukka, Enugu
            </span>
          </div>
        </div>
        <Button variant="link" className="text-destructive">
          Report or block
        </Button>
      </div>

      <div className="bg-surface-feature p-3.5 rounded-lg text-body-sm">
        Meet somewhere public and busy — a bank, a filling station, a campus
        gate. Popular in Wuse: Banex Plaza entrance, Ceddi Plaza, Berger
        junction.
      </div>

      <div className="flex flex-col gap-3 min-h-55">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1",
              m.from === "me" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[78%] rounded-lg border px-4 py-3 text-body-md",
                m.from === "me"
                  ? "bg-surface-feature border-surface-feature"
                  : "bg-canvas border-hairline",
              )}
            >
              {m.text}
            </div>
            <span className="text-caption-bold text-pin-gray-400">
              {m.time}
            </span>
          </div>
        ))}
      </div>

      {revealed ? (
        <div className="flex flex-col gap-1.5 bg-surface-feature p-4 border border-pin-green-600 rounded-lg">
          <span className="text-pin-green-600 text-micro-uppercase">
            Numbers shared
          </span>
          <span className="text-heading-4">Chika — 0806 412 0088</span>
          <span className="text-muted-foreground text-body-sm">
            She can now see yours too. Nyeaka keeps the chat either way, in
            case you need a record.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between items-center gap-3 p-4 border rounded-lg">
          <p className="max-w-[46ch] text-muted-foreground text-body-sm">
            Phone numbers stay hidden until you both agree. Chika has already
            agreed to share hers.
          </p>
          <Button variant="outline" onClick={() => setRevealed(true)}>
            Share my number too
          </Button>
        </div>
      )}

      <div className="flex items-end gap-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Write a message"
          className="flex-1 bg-input/50 px-4 rounded-sm h-12 text-base"
        />
        <Button onClick={send}>Send</Button>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t">
        {!confirmed ? (
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="max-w-[46ch] text-muted-foreground text-body-sm">
              Once the device has changed hands, you both confirm here.
              Ratings only open after that.
            </p>
            <Button variant="secondary" onClick={() => setConfirmed(true)}>
              Confirm handoff
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-heading-4">
              Both of you confirmed the handoff
            </span>
            {!rated ? (
              <div className="flex flex-col gap-3">
                <span className="text-body-md text-muted-foreground">
                  How was meeting Chika?
                </span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={cn(
                        "size-11 text-3xl leading-none",
                        n <= rating
                          ? "text-pin-orange-600"
                          : "text-pin-gray-300",
                      )}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => setRated(true)}
                >
                  Leave rating
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 bg-surface-feature p-4 rounded-lg">
                <span className="font-heading font-semibold text-heading-5">
                  Thank you — that&apos;s one more device online
                </span>
                <span className="text-muted-foreground text-body-sm">
                  Your rating is on Chika&apos;s profile, and hers is on
                  yours.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatThread;

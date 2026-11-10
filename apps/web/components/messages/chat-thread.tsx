"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Thread } from "@/lib/messages";
import { MESSAGE_MAX } from "@/validations/message-validation";
import { sendMessageAction } from "@/actions/messages";
import { Button } from "../ui/button";
import ReportPanel from "../safety/report-panel";
import BlockButton from "../safety/block-button";
import UnblockButton from "../safety/unblock-button";

/** How often the open thread re-fetches. Chat v1 has no realtime connection. */
export const POLL_MS = 10_000;

const formatTime = (d: Date) => {
  const date = new Date(d);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
};

const ChatThread = ({ thread }: { thread: Thread }) => {
  const router = useRouter();
  const [sending, startSend] = useTransition();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const closed = thread.matchStatus === "CANCELLED";
  const canSend = thread.canSend;

  // Poll: re-run the server component so new messages arrive. Skips hidden tabs,
  // catches up the moment the tab is visible again, and stops once the chat is closed.
  useEffect(() => {
    if (!canSend) return;
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canSend, router]);

  // Keep the newest message in view when the list grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    startSend(async () => {
      const res = await sendMessageAction(thread.id, { body });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh(); // e.g. the match was cancelled while this tab was open
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 mx-auto py-6 w-full max-w-3xl section-wrapper">
      <Link
        href="/dashboard"
        className="self-start font-semibold text-body-sm text-link hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b">
        <div className="flex items-center gap-3">
          <span className="flex justify-center items-center bg-surface-feature rounded-full size-11 font-heading font-bold text-pin-green-600">
            {thread.other.firstName[0]?.toUpperCase()}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-5">
              {thread.other.firstName} · about {thread.listingTitle}
            </span>
            <span className="text-muted-foreground text-body-sm">
              {thread.other.idVerified ? "ID-verified · " : ""}
              {thread.place} · for &ldquo;{thread.requestTitle}&rdquo;
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ReportPanel targetType="USER" targetId={thread.other.id} who={thread.other.firstName} />
          {thread.blockedByMe ? (
            <UnblockButton userId={thread.other.id} who={thread.other.firstName} />
          ) : (
            <BlockButton userId={thread.other.id} who={thread.other.firstName} />
          )}
        </div>
      </div>

      <div className="bg-surface-feature p-3.5 rounded-lg text-body-sm">
        Meet somewhere public and busy — a bank, a filling station, a campus
        gate — and bring a friend if you can.
      </div>

      {thread.blockedByMe ? (
        <div role="status" className="bg-pin-orange-100 p-3.5 rounded-lg text-body-sm">
          {closed
            ? `You blocked ${thread.other.firstName}, so this match was cancelled and the chat is closed. Unblocking them won't reopen it, but you can match again.`
            : `You blocked ${thread.other.firstName}. Unblock them to message again.`}
        </div>
      ) : closed ? (
        <div role="status" className="bg-pin-orange-100 p-3.5 rounded-lg text-body-sm">
          This match was cancelled, so the chat is closed. The device and the
          request are open to new offers again.
        </div>
      ) : (
        !canSend && (
          <div role="status" className="bg-pin-orange-100 p-3.5 rounded-lg text-body-sm">
            Messages are closed for this conversation.
          </div>
        )
      )}

      <div className="flex flex-col gap-3 min-h-55" aria-live="polite">
        {thread.messages.length === 0 && (
          <p className="text-muted-foreground text-body-sm">
            No messages yet. Say hello and suggest a public place and time to meet.
          </p>
        )}
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col gap-1", m.mine ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[78%] whitespace-pre-wrap break-words rounded-lg border px-4 py-3 text-body-md",
                m.mine
                  ? "bg-surface-feature border-surface-feature"
                  : "bg-canvas border-hairline",
              )}
            >
              {m.body}
            </div>
            <time
              dateTime={new Date(m.createdAt).toISOString()}
              suppressHydrationWarning
              className="text-caption-bold text-pin-gray-400"
            >
              {formatTime(m.createdAt)}
            </time>
          </div>
        ))}
      </div>

      {canSend && (
        <form onSubmit={send} className="flex items-end gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message"
            aria-label="Write a message"
            maxLength={MESSAGE_MAX}
            autoComplete="off"
            className="flex-1 bg-input/50 px-4 rounded-sm h-12 text-base"
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </form>
      )}
      {/* After the composer, so scrolling here keeps the latest message and the input in view. */}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatThread;

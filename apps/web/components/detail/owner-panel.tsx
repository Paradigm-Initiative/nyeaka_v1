import React from "react";
import PostActions from "../post/post-actions";
import type { PostState } from "@/lib/lifecycle";

const COPY: Record<PostState, string> = {
  ACTIVE: "This is your post. People can see it until it expires.",
  EXPIRED: "This post has expired and is hidden from browsing.",
  CLOSED: "You closed this post. It is hidden from browsing.",
  MATCHED: "This post has been matched.",
};

/** Replaces the contact form when the viewer owns the post. */
const OwnerPanel = ({
  kind,
  id,
  state,
  expiresAt,
}: {
  kind: "listing" | "request";
  id: string;
  state: PostState;
  expiresAt: Date;
}) => (
  <div className="flex flex-col gap-3 bg-pin-orange-100 p-4 rounded-lg">
    <p className="text-body-sm">
      {COPY[state]}
      {state === "ACTIVE" && ` Expires ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`}
    </p>
    <PostActions kind={kind} id={id} state={state} />
  </div>
);

export default OwnerPanel;

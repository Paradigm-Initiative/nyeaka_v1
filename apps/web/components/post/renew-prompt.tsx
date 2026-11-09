import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import PostActions from "./post-actions";
import type { PostState } from "@/lib/lifecycle";

/** Shown instead of the edit form when a post is closed or expired. */
const RenewPrompt = ({
  kind,
  id,
  title,
  state,
}: {
  kind: "listing" | "request";
  id: string;
  title: string;
  state: PostState;
}) => (
  <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
    <h1 className="text-heading-2">This {kind} isn&apos;t live</h1>
    <p className="text-body-lg text-muted-foreground text-pretty">
      &ldquo;{title}&rdquo; is {state === "CLOSED" ? "closed" : "expired"}, so it can&apos;t be edited. {state === "CLOSED" ? "Reopen" : "Renew"} it for
      another 60 days to edit it and make it visible again.
    </p>
    <div className="flex flex-wrap gap-3">
      <PostActions kind={kind} id={id} state={state} />
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  </div>
);

export default RenewPrompt;

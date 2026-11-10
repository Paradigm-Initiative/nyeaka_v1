"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import FormError from "../post/form-error";
import { rateMatchAction } from "@/actions/lifecycle";
import { RATING_COMMENT_MAX } from "@/lib/rating-rules";
import type { Thread } from "@/lib/messages";

const RatingForm = ({
  matchId,
  who,
  rating,
  cancelled,
}: {
  matchId: string;
  who: string;
  rating: Thread["rating"];
  cancelled: boolean;
}) => {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();

  if (rating.mine)
    return (
      <div className="flex flex-col gap-1.5 bg-surface-feature p-4 rounded-lg">
        <span className="font-heading font-semibold text-heading-5">
          Thank you. You rated {who} {rating.mine.score} ★
        </span>
        <span className="text-muted-foreground text-body-sm">
          Your rating is on {who}&rsquo;s profile.
        </span>
      </div>
    );

  if (!rating.canRate)
    return rating.reason ? <p className="text-muted-foreground text-body-sm">{rating.reason}</p> : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await rateMatchAction(matchId, { score, comment });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast.success("Rating saved");
          router.refresh();
        });
      }}
      className="flex flex-col gap-3"
    >
      <span className="text-body-md text-muted-foreground">
        {cancelled ? `This match was cancelled. How was talking to ${who}?` : `How was meeting ${who}?`}
      </span>
      <div className="flex gap-2" role="group" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={n <= score}
            onClick={() => setScore(n)}
            className={cn("size-11 text-3xl leading-none", n <= score ? "text-pin-orange-600" : "text-pin-gray-300")}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={RATING_COMMENT_MAX}
        placeholder="Add a comment (optional)"
        className="min-h-20 rounded-sm"
      />
      <FormError message={error} />
      <Button type="submit" className="self-start" disabled={pending || score === 0}>
        {pending ? "Saving…" : "Leave rating"}
      </Button>
    </form>
  );
};

export default RatingForm;

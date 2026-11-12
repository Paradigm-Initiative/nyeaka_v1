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
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";

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
  const t = useTranslations("rating");
  const errText = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();

  if (rating.mine)
    return (
      <div className="flex flex-col gap-1.5 bg-surface-feature p-4 rounded-lg">
        <span className="font-heading font-semibold text-heading-5">
          {t("thanks", { who, score: rating.mine.score })}
        </span>
        <span className="text-muted-foreground text-body-sm">
          {t("onProfile", { who })}
        </span>
      </div>
    );

  if (!rating.canRate)
    return rating.reason ? <p className="text-muted-foreground text-body-sm">{errText(rating.reason)}</p> : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await rateMatchAction(matchId, { score, comment });
          if (!res.ok) {
            setError(errText(res.error));
            return;
          }
          toast.success(t("saved"));
          router.refresh();
        });
      }}
      className="flex flex-col gap-3"
    >
      <span className="text-body-md text-muted-foreground">
        {t(cancelled ? "howWasTalking" : "howWasMeeting", { who })}
      </span>
      <div className="flex gap-2" role="group" aria-label={t("stars")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("star", { count: n })}
            aria-pressed={n <= score}
            onClick={() => setScore(n)}
            className={cn("size-11 text-3xl leading-none", n <= score ? "text-pin-orange-600" : "text-pin-gray-300")}
          >
            ★
          </Button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={RATING_COMMENT_MAX}
        placeholder={t("comment")}
        className="min-h-20 rounded-sm"
      />
      <FormError message={error} />
      <Button type="submit" className="self-start" disabled={pending || score === 0}>
        {pending ? t("saving") : t("leave")}
      </Button>
    </form>
  );
};

export default RatingForm;

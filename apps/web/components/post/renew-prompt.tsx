import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import PostActions from "./post-actions";
import type { PostState } from "@/lib/lifecycle";
import { useTranslations } from "next-intl";

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
}) => {
  const t = useTranslations("renewPrompt");
  return (
    <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
      <h1 className="text-heading-2">{t(`title.${kind}`)}</h1>
      <p className="text-body-lg text-muted-foreground text-pretty">
        {t(`body.${state === "CLOSED" ? "closed" : "expired"}`, { title })}
      </p>
      <div className="flex flex-wrap gap-3">
        <PostActions kind={kind} id={id} state={state} />
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default RenewPrompt;

import React from "react";
import PostActions from "../post/post-actions";
import type { PostState } from "@/lib/lifecycle";
import { useFormatter, useTranslations } from "next-intl";

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
}) => {
  const t = useTranslations("owner");
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-3 bg-pin-orange-100 p-4 rounded-lg">
      <p className="text-body-sm">
        {t(`state.${state}`)}
        {state === "ACTIVE" &&
          ` ${t("expires", { date: format.dateTime(expiresAt, { day: "numeric", month: "short", year: "numeric" }) })}`}
      </p>
      <PostActions kind={kind} id={id} state={state} />
    </div>
  );
};

export default OwnerPanel;

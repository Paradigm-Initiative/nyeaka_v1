"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  closeReportedPostAction,
  dismissReportAction,
  liftRestrictionAction,
  suspendUserAction,
} from "@/actions/admin";

/** Admin only, English only. What to do about one open report. */
export default function ReportActions({
  reportId, userId, userName, hasPost, restricted, suspended, isAdmin,
}: {
  reportId: string; userId: string; userName: string; hasPost: boolean;
  restricted: boolean; suspended: boolean; isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await work();
      if (!res.ok) return void toast.error(res.error ?? "Something went wrong.");
      toast.success(done);
      setSuspending(false);
      router.refresh();
    });

  if (suspending)
    return (
      <div className="flex flex-col gap-2 bg-pin-orange-100 p-3 rounded-lg">
        <p className="text-body-sm">
          Suspend {userName}? They are signed out and can&apos;t sign in, their posts close, their matches are cancelled,
          and their ID document is remembered for 12 months.
        </p>
        <Textarea value={reason} maxLength={500} placeholder="Reason (kept in the activity log)" onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => suspendUserAction(userId, reason), `${userName} suspended`)}>
            {pending ? "Suspending…" : "Suspend"}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSuspending(false)}>Cancel</Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => dismissReportAction(reportId), "Report dismissed")}>Dismiss</Button>
      {hasPost && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => closeReportedPostAction(reportId), "Post closed")}>Close the post</Button>
      )}
      {restricted && !suspended && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => liftRestrictionAction(userId), "Restriction lifted")}>Lift restriction</Button>
      )}
      {!suspended && !isAdmin && (
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => setSuspending(true)}>Suspend…</Button>
      )}
    </div>
  );
}

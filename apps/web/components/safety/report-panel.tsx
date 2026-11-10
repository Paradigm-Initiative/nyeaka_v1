"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import FormError from "../post/form-error";
import { reportAction } from "@/actions/safety";
import { REPORT_REASONS } from "@/lib/report-options";

/**
 * A "Report" button that opens a small inline form. Only shown where the viewer
 * and the reported person share a chat (the server enforces this too).
 */
const ReportPanel = ({
  targetType,
  targetId,
  who,
  label = "Report",
}: {
  targetType: "USER" | "LISTING" | "REQUEST";
  targetId: string;
  /** First name of the person, for the heading. */
  who: string;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  if (done)
    return (
      <p role="status" className="text-body-sm text-muted-foreground">
        Thanks. We&rsquo;ve sent your report to the Nyeaka team to review.
      </p>
    );

  if (!open)
    return (
      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await reportAction({ targetType, targetId, reason, details });
      if (!res.ok) {
        setError(res.fieldErrors?.reason ?? res.error);
        return;
      }
      toast.success("Report sent");
      setDone(true);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4 border rounded-lg">
      <span className="font-heading font-semibold text-heading-6">Report {who}</span>
      <div className="flex flex-col gap-1.5 text-body-sm">
        <Label htmlFor="report-reason" className="font-semibold text-body-sm leading-normal">
          What happened?
        </Label>
        <Select value={reason || undefined} onValueChange={setReason}>
          <SelectTrigger id="report-reason" className="rounded-sm min-h-11">
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
        placeholder="Anything we should know? (optional)"
        className="min-h-20 rounded-sm"
      />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pending || !reason}>
          {pending ? "Sending…" : "Send report"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default ReportPanel;

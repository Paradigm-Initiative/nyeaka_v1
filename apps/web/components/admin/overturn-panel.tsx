"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { overturnVerificationAction } from "@/actions/admin";

/** Admin only, English only. Sends a past decision back; says plainly what happens to the images. */
export default function OverturnPanel({ id, imagesPurged }: { id: string; imagesPurged: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const run = () =>
    start(async () => {
      const res = await overturnVerificationAction(id, note);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.reopened ? "Overturned. The case is back in the queue." : "Overturned. The person must submit again.");
      setOpen(false);
      router.refresh();
    });

  if (!open)
    return (
      <div className="pt-4 border-t">
        <Button variant="outline" onClick={() => setOpen(true)}>Overturn this decision…</Button>
      </div>
    );
  return (
    <section className="flex flex-col gap-3 pt-4 border-t">
      <h2 className="text-heading-4">Overturn this decision</h2>
      <p className="text-body-sm">
        {imagesPurged
          ? "The images have been deleted, so this case can't be reviewed again. The person's status goes back to “not verified” and they must submit again."
          : "The case goes back to the queue and the person's status returns to “pending”. The images are kept for the re-review (the deletion date is cleared), and a new 30-day period starts when it is decided again."}
      </p>
      <label htmlFor="overturn-note" className="font-semibold text-body-sm">Why (kept in the activity log)</label>
      <Textarea id="overturn-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="destructive" disabled={pending || note.trim().length < 3} onClick={run}>{pending ? "Overturning…" : "Overturn"}</Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVerificationAction,
  rejectVerificationAction,
  viewVerificationImagesAction,
} from "@/actions/admin";

type Urls = { front: string; back: string | null; selfie: string };

/** Admin only, English only. Shows the ID images (each view is logged) and records the decision. */
export default function ReviewPanel({
  id,
  status,
  isOwn,
  imagesDeleted,
  hasBack,
}: {
  id: string;
  status: string;
  isOwn: boolean;
  imagesDeleted: boolean;
  hasBack: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [urls, setUrls] = useState<Urls | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const show = () =>
    start(async () => {
      const res = await viewVerificationImagesAction(id);
      if (!res.ok) return void toast.error(res.error);
      setUrls(res.data);
    });

  const decide = (approve: boolean) =>
    start(async () => {
      const res = approve ? await approveVerificationAction(id) : await rejectVerificationAction(id, reason);
      if (!res.ok) return void toast.error(res.error);
      toast.success(approve ? "Approved. The person has been emailed." : "Rejected. The person has been emailed.");
      setUrls(null);
      router.refresh();
    });

  if (isOwn) return <p className="p-4 border rounded-lg text-muted-foreground">You can&apos;t review your own verification.</p>;

  const img = (src: string, label: string) => (
    <figure key={label} className="flex flex-col flex-1 gap-1 min-w-48">
      <Image src={src} alt={label} width={600} height={400} unoptimized className="rounded-sm w-full h-auto" />
      <figcaption className="text-muted-foreground text-caption">{label}</figcaption>
    </figure>
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading-4">Images</h2>
      {imagesDeleted ? (
        <p className="text-muted-foreground text-body-sm">The images have been deleted.</p>
      ) : urls ? (
        <>
          <div className="flex flex-wrap gap-3">
            {img(urls.front, "Front")}
            {urls.back && img(urls.back, "Back")}
            {img(urls.selfie, "Selfie")}
          </div>
          <p className="text-muted-foreground text-caption">
            These links stop working after a minute. Reloading them is logged again.
          </p>
        </>
      ) : (
        <div>
          <Button variant="outline" disabled={pending} onClick={show}>
            {pending ? "Loading…" : `Show images${hasBack ? "" : " (no back side)"}`}
          </Button>
          <p className="mt-1 text-muted-foreground text-caption">Viewing is recorded in the activity log.</p>
        </div>
      )}

      {status === "PENDING" && (
        <div className="flex flex-col gap-3 pt-2 border-t">
          {rejecting ? (
            <>
              <label htmlFor="reason" className="font-semibold text-body-sm">
                Reason (sent to the person, so keep it clear and kind)
              </label>
              <Textarea id="reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => decide(false)}>
                  {pending ? "Rejecting…" : "Reject"}
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Button disabled={pending} onClick={() => decide(true)}>{pending ? "Approving…" : "Approve"}</Button>
              <Button variant="outline" disabled={pending} onClick={() => setRejecting(true)}>Reject…</Button>
            </div>
          )}
          <p className="text-muted-foreground text-caption">
            Approving or rejecting schedules the images for deletion in 30 days.
          </p>
        </div>
      )}
    </section>
  );
}

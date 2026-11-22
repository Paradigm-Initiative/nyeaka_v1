"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimVerificationAction, releaseVerificationAction } from "@/actions/admin";

/**
 * Opening a pending case claims it (done here, not while rendering, so a prefetch can't claim
 * cases nobody opened). Admin only, English only.
 */
export default function ClaimGate({ id, shouldClaim, mine, expires }: { id: string; shouldClaim: boolean; mine: boolean; expires: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = useRef(false);

  useEffect(() => {
    if (!shouldClaim || done.current) return;
    done.current = true;
    claimVerificationAction(id).then((res) => {
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }, [id, shouldClaim, router]);

  if (!mine) return null;
  return (
    <div className="flex flex-wrap justify-between items-center gap-2 bg-surface-feature p-3 border rounded-lg text-body-sm">
      <span>
        You have this case{expires ? ` until ${expires}` : ""}. The claim renews as you work and lapses after 15 minutes of inactivity.
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await releaseVerificationAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Released back to the queue.");
          router.push("/admin/verifications");
        })}
      >
        Release
      </Button>
    </div>
  );
}

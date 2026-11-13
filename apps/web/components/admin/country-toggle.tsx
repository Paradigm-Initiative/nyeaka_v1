"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCountryEnabledAction } from "@/actions/admin";

/** Admin only, English only. Enables or disables one country. */
export default function CountryToggle({
  code,
  name,
  enabled,
  disabledReason,
}: {
  code: string;
  name: string;
  enabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = () =>
    start(async () => {
      const res = await setCountryEnabledAction(code, !enabled);
      setConfirming(false);
      if (!res.ok) return void toast.error(res.error);
      toast.success(enabled ? `${name} switched off` : `${name} switched on`);
      router.refresh();
    });

  // Switching a country off affects real people, so it asks first.
  if (enabled && confirming)
    return (
      <span className="flex items-center gap-2">
        <span className="text-caption">Stop sign-ups and posting in {name}?</span>
        <Button size="sm" variant="destructive" disabled={pending} onClick={run}>
          {pending ? "Switching off…" : "Switch off"}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );

  return (
    <Button
      size="sm"
      variant={enabled ? "outline" : "default"}
      disabled={pending || !!disabledReason}
      title={disabledReason}
      onClick={() => (enabled ? setConfirming(true) : run())}
    >
      {enabled ? "Switch off" : pending ? "Switching on…" : "Switch on"}
    </Button>
  );
}

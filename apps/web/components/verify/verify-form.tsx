"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const VerifyForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsId = searchParams.get("level") === "2";

  const heading = needsId
    ? "Before you list, we confirm it is really you"
    : "Before you request, we confirm it is really you";
  const reason = needsId
    ? "The person collecting this device is going to meet you in person. They deserve to know your name is real — and you deserve the same from them."
    : "Donors choose who receives their device. Knowing every requester is a real, single, verified person is what makes that choice safe to make.";

  const finish = () => {
    toast.success("Verification submitted");
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col gap-5 mx-auto py-8 max-w-2xl">
      <h1 className="text-heading-2 text-pretty">{heading}</h1>
      <p className="text-muted-foreground text-body-lg text-pretty">
        {reason}
      </p>

      <div className="flex flex-col gap-4 p-4 border rounded-lg">
        <div className="flex items-start gap-3">
          <span className="flex flex-none justify-center items-center bg-surface-feature rounded-full size-7 font-heading font-bold text-pin-green-600 text-sm">
            ✓
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold text-heading-6">
              Phone confirmed
            </span>
            <span className="text-muted-foreground text-body-sm">
              Done at sign-up. This is all you need to browse.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex flex-none justify-center items-center bg-pin-green-600 rounded-full size-7 font-heading font-bold text-white text-sm">
            2
          </span>
          <div className="flex flex-col flex-1 gap-1.5">
            <span className="font-heading font-semibold text-heading-6">
              National Identity Number
            </span>
            <span className="text-muted-foreground text-body-sm">
              We check the NIN matches your name. Nothing is stored beyond a
              yes or no, and it never appears on your profile.
            </span>
            <Input placeholder="11-digit NIN" className="mt-1 h-13 rounded-sm" />
          </div>
        </div>

        {needsId && (
          <div className="flex items-start gap-3">
            <span className="flex flex-none justify-center items-center bg-pin-green-600 rounded-full size-7 font-heading font-bold text-white text-sm">
              3
            </span>
            <div className="flex flex-col flex-1 gap-2">
              <span className="font-heading font-semibold text-heading-6">
                ID photo and a selfie
              </span>
              <span className="text-muted-foreground text-body-sm">
                Only for people listing devices — a reviewer checks the two
                match. Usually under an hour; you can finish your listing
                while it&apos;s pending.
              </span>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-1 justify-center items-center border border-hairline-strong border-dashed rounded-sm min-w-35 h-24 text-muted-foreground text-body-sm">
                  Photo of your ID
                </div>
                <div className="flex flex-1 justify-center items-center border border-hairline-strong border-dashed rounded-sm min-w-35 h-24 text-muted-foreground text-body-sm">
                  Selfie holding it
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface-feature p-4 rounded-lg text-body-sm">
        Nyeaka is free and always will be. We ask for this once, not per
        handoff — and nobody sees your documents except the reviewer.
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="lg" onClick={finish}>
          Verify and continue
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/listings">Keep browsing for now</Link>
        </Button>
      </div>
    </div>
  );
};

export default VerifyForm;

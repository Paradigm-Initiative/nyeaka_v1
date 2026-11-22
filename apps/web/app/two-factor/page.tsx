import type { Metadata } from "next";
import TwoFactorChallenge from "./challenge";

// Shown after the password step to anyone with two-factor on (in practice, staff). English only.
export const metadata: Metadata = { title: "Two-factor sign-in - Nyeaka", robots: { index: false } };

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <TwoFactorChallenge />
      </div>
    </div>
  );
}

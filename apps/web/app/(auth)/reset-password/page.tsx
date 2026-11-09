import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password - Nyeaka",
};

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password - Nyeaka",
};

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

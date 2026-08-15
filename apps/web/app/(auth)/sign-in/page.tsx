import { Suspense } from "react";
import { LoginForm } from "@/app/(auth)/sign-in/login-form";

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-105">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

import { SignupForm } from "@/app/(auth)/sign-up/signup-form";

export default function Page() {
  return (
    <div className="flex justify-center items-center bg-black/55 bg-blend-overlay p-6 md:p-10 w-full min-h-svh sign-up-bg">
      <div className="w-full max-w-xl">
        <SignupForm />
      </div>
    </div>
  );
}

import { SignupForm } from "@/app/(auth)/sign-up/signup-form";

export default function Page() {
  return (
    <div className="flex justify-center py-14 section-wrapper">
      <div className="w-full max-w-115">
        <SignupForm />
      </div>
    </div>
  );
}

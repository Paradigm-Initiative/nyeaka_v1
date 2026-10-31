import { SignupForm } from "@/app/(auth)/sign-up/signup-form";

export default function Page() {
  return (
    <div className="flex-col flex-1 flex-center py-14 h-full">
      <div className="w-full max-w-115">
        <SignupForm />
      </div>
    </div>
  );
}

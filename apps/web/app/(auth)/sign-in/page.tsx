import { LoginForm } from "@/app/(auth)/sign-in/login-form";

export default function Page() {
  return (
    <div className="flex justify-center items-center bg-primary/55 p-6 md:p-10 w-full min-h-svh">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}

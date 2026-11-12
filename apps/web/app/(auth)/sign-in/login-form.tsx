"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import FieldInput from "@/components/custom/field-input";
import { SignInSchema, signInSchema } from "@/validations/auth-validation";
import { useState } from "react";
import { safeRedirectPath } from "@/lib/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInSchema>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignInSchema) => {
    const { email, password } = values;
    try {
      const { error } = await signIn.email({
        email,
        password,
      });

      if (error) {
        if (error.status === 403) {
          // Email not verified: Better Auth re-sends the link on sign-in.
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(error.message || "Something went wrong");
      } else {
        toast.success("Logged in successfully");
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Error during sign-in:", error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">Welcome back</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <FieldInput
                label="Email address"
                name="email"
                type="email"
                placeholder="you@example.com"
                field={field}
                errorMessage={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <FieldInput
                label="Password"
                name="password"
                type="password"
                isPassword
                field={field}
                errorMessage={errors.password?.message}
              />
            )}
          />

          {error && (
            <FieldError className="font-semibold text-xs">{error}</FieldError>
          )}

          <Link
            href="/forgot-password"
            className="inline-flex items-center self-start min-h-11 font-semibold text-body-sm text-link hover:underline"
          >
            Forgot your password?
          </Link>

          <div className="flex flex-col items-start gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Sign in
            </Button>
            <Button variant="link" type="button" asChild>
              <Link href="/sign-up">Create an account instead</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

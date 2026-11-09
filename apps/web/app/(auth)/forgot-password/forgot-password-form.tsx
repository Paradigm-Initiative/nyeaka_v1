"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import FieldInput from "@/components/custom/field-input";
import { requestPasswordReset } from "@/lib/auth-client";
import {
  ForgotPasswordSchema,
  forgotPasswordSchema,
} from "@/validations/auth-validation";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordSchema) => {
    setError(null);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    if (error) {
      setError(error.message || "Something went wrong");
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-heading-2">Check your email</h1>
        <p className="text-muted-foreground text-body-md">
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent a
          link to reset your password. It expires in 1 hour.
        </p>
        <Button variant="link" asChild className="p-0">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">Forgot your password?</h1>
      <p className="text-muted-foreground text-body-md">
        Enter your email and we&apos;ll send you a link to choose a new one.
      </p>
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
          {error && (
            <FieldError className="font-semibold text-xs">{error}</FieldError>
          )}
          <div className="flex flex-col items-start gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Send reset link
            </Button>
            <Button variant="link" asChild className="p-0">
              <Link href="/sign-in">Back to sign in</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

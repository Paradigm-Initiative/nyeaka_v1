"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import FieldInput from "@/components/custom/field-input";
import { resetPassword } from "@/lib/auth-client";
import {
  ResetPasswordSchema,
  resetPasswordSchema,
} from "@/validations/auth-validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkInvalid = !token || searchParams.get("error") === "INVALID_TOKEN";
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (linkInvalid) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-heading-2">This link isn&apos;t valid</h1>
        <p className="text-muted-foreground text-body-md">
          The reset link is invalid or has expired. Request a new one to
          continue.
        </p>
        <Button asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordSchema) => {
    setError(null);
    const { error } = await resetPassword({ newPassword: password, token });
    if (error) {
      setError(error.message || "Something went wrong");
      return;
    }
    toast.success("Password updated. Please sign in.");
    router.push("/sign-in");
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">Choose a new password</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <FieldInput
                label="New password"
                name="password"
                type="password"
                isPassword
                field={field}
                errorMessage={errors.password?.message}
                description="Must be at least 10 characters long."
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <FieldInput
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                isPassword
                field={field}
                errorMessage={errors.confirmPassword?.message}
              />
            )}
          />
          {error && (
            <FieldError className="font-semibold text-xs">{error}</FieldError>
          )}
          <Button type="submit" disabled={isSubmitting} className="self-start">
            Update password
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

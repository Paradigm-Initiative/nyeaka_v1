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
import { useTranslations } from "next-intl";
import { useAuthErrorText, useErrorText } from "@/lib/use-error-text";
import {
  ResetPasswordSchema,
  resetPasswordSchema,
} from "@/validations/auth-validation";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const authError = useAuthErrorText();
  const errText = useErrorText();
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
        <h1 className="text-heading-2">{t("invalidTitle")}</h1>
        <p className="text-muted-foreground text-body-md">
          {t("invalidBody")}
        </p>
        <Button asChild>
          <Link href="/forgot-password">{t("newLink")}</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordSchema) => {
    setError(null);
    const { error } = await resetPassword({ newPassword: password, token });
    if (error) {
      setError(authError(error.code));
      return;
    }
    toast.success(t("success"));
    router.push("/sign-in");
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">{t("title")}</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <FieldInput
                label={t("password")}
                name="password"
                type="password"
                isPassword
                field={field}
                errorMessage={errText(errors.password?.message)}
                description={t("passwordHint")}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <FieldInput
                label={t("confirm")}
                name="confirmPassword"
                type="password"
                isPassword
                field={field}
                errorMessage={errText(errors.confirmPassword?.message)}
              />
            )}
          />
          {error && (
            <FieldError className="font-semibold text-xs">{error}</FieldError>
          )}
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {t("submit")}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import FieldInput from "@/components/custom/field-input";
import { requestPasswordReset } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { useAuthErrorText, useErrorText } from "@/lib/use-error-text";
import {
  ForgotPasswordSchema,
  forgotPasswordSchema,
} from "@/validations/auth-validation";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const authError = useAuthErrorText();
  const errText = useErrorText();
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
      setError(authError(error.code));
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-heading-2">{t("sentTitle")}</h1>
        <p className="text-muted-foreground text-body-md">
          {t.rich("sentBody", { email: sentTo, strong: (c) => <strong>{c}</strong> })}
        </p>
        <Button variant="link" asChild className="p-0">
          <Link href="/sign-in">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-2">{t("title")}</h1>
      <p className="text-muted-foreground text-body-md">
        {t("subtitle")}
      </p>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <FieldInput
                label={t("email")}
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                field={field}
                errorMessage={errText(errors.email?.message)}
              />
            )}
          />
          {error && (
            <FieldError className="font-semibold text-xs">{error}</FieldError>
          )}
          <div className="flex flex-col items-start gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {t("submit")}
            </Button>
            <Button variant="link" asChild className="p-0">
              <Link href="/sign-in">{t("back")}</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SignUpSchema, signUpSchema } from "@/validations/auth-validation";

import { signUp } from "@/lib/auth-client";
import FieldInput from "@/components/custom/field-input";
import { AppleIcon, GoogleIcon } from "@/components/custom/brand-icons";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CountrySelect, { type CountryOption } from "@/components/post/country-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { useAuthErrorText, useErrorText } from "@/lib/use-error-text";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export function SignupForm({ countries }: { countries: CountryOption[] }) {
  const t = useTranslations("auth.signUp");
  const locale = useLocale();
  const authError = useAuthErrorText();
  const errText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      // With a single enabled country there is nothing to choose, so it is preselected.
      countryCode: countries.length === 1 ? countries[0].code : "",
      password: "",
      confirmPassword: "",
    },
  });

  const submitHandler = async (values: SignUpSchema) => {
    const { email, firstName, lastName, countryCode, password } = values;
    setError(null);
    const { error } = await signUp.email({
      email,
      password,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      countryCode,
      locale,
      callbackURL: "/email-verified",
    });

    if (error) {
      setError(authError(error.code));
    } else {
      toast.success(t("success"));
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <Card className="flex flex-col flex-1 justify-center gap-4">
      <CardHeader className="flex flex-col gap-2">
        <h2 className="text-heading-2">{t("title")}</h2>
        <p className="text-body-md text-muted-foreground">
          {t("subtitle")}
        </p>
      </CardHeader>
      <form onSubmit={handleSubmit(submitHandler)}>
        <CardContent>
          <FieldGroup className="gap-4">
            <div className="gap-3 grid grid-cols-2">
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <FieldInput
                    label={t("firstName")}
                    type="text"
                    name="firstName"
                    placeholder={t("namePlaceholder")}
                    field={field}
                    errorMessage={errText(errors.firstName?.message)}
                  />
                )}
              />
              <Controller
                control={control}
                name="lastName"
                render={({ field }) => (
                  <FieldInput
                    label={t("lastName")}
                    type="text"
                    name="lastName"
                    placeholder={t("namePlaceholder")}
                    field={field}
                    errorMessage={errText(errors.lastName?.message)}
                  />
                )}
              />
            </div>

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

            <Controller
              control={control}
              name="countryCode"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="countryCode">{t("country")}</FieldLabel>
                  <CountrySelect
                    id="countryCode"
                    countries={countries}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.countryCode}
                  />
                  {errors.countryCode && (
                    <FieldError>{errText(errors.countryCode.message)}</FieldError>
                  )}
                </Field>
              )}
            />

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
                  label={t("confirmPassword")}
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

            <div className="flex flex-col items-start gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                {t("submit")}
              </Button>
              <p>
                {t("haveAccount")}
                <Button
                  variant="link"
                  type="button"
                  asChild
                  className="ml-0.5 p-0"
                >
                  <Link href="/sign-in">{t("signIn")}</Link>
                </Button>
              </p>
            </div>
          </FieldGroup>
        </CardContent>
      </form>
      <CardFooter>
        {/* sign in with google and sign in with Apple */}
        <div className="gap-2 grid grid-cols-1 md:grid-cols-2 w-full">
          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={() => {
              toast.error(t("googleSoon"));
            }}
          >
            <GoogleIcon className="text-[#4285F4]" />
            {t("google")}
          </Button>
          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={() => {
              toast.error(t("appleSoon"));
            }}
          >
            <AppleIcon />
            {t("apple")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

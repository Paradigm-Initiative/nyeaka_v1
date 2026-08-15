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
import { useState } from "react";

export function SignupForm() {
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
      password: "",
      confirmPassword: "",
    },
  });

  const submitHandler = async (values: SignUpSchema) => {
    const { email, firstName, lastName, password } = values;
    setError(null);
    const { error } = await signUp.email({
      email,
      password,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      callbackURL: "/email-verified",
    });

    if (error) {
      setError(error.message || "Something went wrong");
    } else {
      toast.success("Account created successfully");
      router.push("/");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-2">Create your account</h1>
        <p className="text-muted-foreground text-body-md">
          One account covers both sides — you can give a device today and
          ask for one next year.
        </p>
      </div>

      <form onSubmit={handleSubmit(submitHandler)}>
        <FieldGroup className="gap-4">
          <div className="gap-3 grid grid-cols-2">
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <FieldInput
                  label="First name"
                  type="text"
                  name="firstName"
                  placeholder="As it appears on your ID"
                  field={field}
                  errorMessage={errors.firstName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <FieldInput
                  label="Last name"
                  type="text"
                  name="lastName"
                  placeholder="As it appears on your ID"
                  field={field}
                  errorMessage={errors.lastName?.message}
                />
              )}
            />
          </div>

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
                description="Must be at least 10 characters long."
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field }) => (
              <FieldInput
                label="Please confirm your password"
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

          <div className="flex flex-col items-start gap-3">
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              Create account
            </Button>
            <Button variant="link" type="button" asChild>
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

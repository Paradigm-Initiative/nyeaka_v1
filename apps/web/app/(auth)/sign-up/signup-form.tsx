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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

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
    <Card className="flex flex-col flex-1 justify-center gap-4">
      <CardHeader className="flex flex-col gap-2">
        <h2 className="text-heading-2">Create your account</h2>
        <p className="text-body-md text-muted-foreground">
          One account covers both sides — you can give a device today and ask
          for one next year.
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
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                Create account
              </Button>
              <p>
                Already have an account?
                <Button
                  variant="link"
                  type="button"
                  asChild
                  className="ml-0.5 p-0"
                >
                  <Link href="/sign-in">Sign in</Link>
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
              toast.error("Sign in with Google is not implemented yet");
            }}
          >
            <GoogleIcon className="text-[#4285F4]" />
            Sign up with Google
          </Button>
          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={() => {
              toast.error("Sign in with Apple is not implemented yet");
            }}
          >
            <AppleIcon />
            Sign up with Apple
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

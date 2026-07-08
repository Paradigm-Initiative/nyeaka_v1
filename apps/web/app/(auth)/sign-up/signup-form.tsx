"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { SignUpSchema, signUpSchema } from "@/validations/auth";

import PasswordInput from "@/components/ui/password";

// import sign up function from better auth client
import { signUp } from "@/lib/auth-client";
import LabelInputWithAnimation from "@/components/custom/label-animation-input";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter();

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
    console.log("Form values: ", values);
    // const { error } = await signUp();
    // console.log(error);
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submitHandler)}>
          <FieldGroup>
            {/* first name and last name */}
            <div className="gap-4 grid grid-cols-2">
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <Field>
                    <LabelInputWithAnimation
                      label="First Name"
                      type="text"
                      name="firstName"
                      field={field}
                    />
                    <FieldError>{errors.firstName?.message}</FieldError>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="lastName"
                render={({ field }) => (
                  <Field>
                    <LabelInputWithAnimation
                      label="Last Name"
                      type="text"
                      name="lastName"
                      field={field}
                    />
                    <FieldError>{errors.lastName?.message}</FieldError>
                  </Field>
                )}
              />
            </div>
            {/* email address here */}
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Field>
                  <LabelInputWithAnimation
                    label="Email address"
                    name="email"
                    type="email"
                    field={field}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </Field>
              )}
            />

            {/* passwords here */}

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Field>
                  <LabelInputWithAnimation
                    label="Password"
                    name="password"
                    type="password"
                    isPassword
                    field={field}
                  />
                  {errors.password ? (
                    <FieldError className="text-xs">
                      {errors.password?.message}
                    </FieldError>
                  ) : (
                    <FieldDescription>
                      Must be at least 10 characters long.
                    </FieldDescription>
                  )}
                </Field>
              )}
            />

            {/* confirm password */}
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <Field>
                  <LabelInputWithAnimation
                    label="Please confirm your password"
                    name="confirmPassword"
                    type="password"
                    isRepeatPassword
                    field={field}
                  />
                  <FieldError>{errors.confirmPassword?.message}</FieldError>
                  <FieldDescription>
                    Must be at least 10 characters long.
                  </FieldDescription>
                </Field>
              )}
            />

            <FieldGroup>
              <Field>
                <Button type="submit">Create Account</Button>
                <Button variant="outline" type="button">
                  Sign up with Google
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account? <a href="#">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
} from "@/components/ui/field";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SignUpSchema, signUpSchema } from "@/validations/auth-validation";

// import sign up function from better auth client
import { signUp } from "@/lib/auth-client";
import LabelInputWithAnimation from "@/components/custom/label-animation-input";
import { useState } from "react";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
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
    console.log("Form values: ", values);
    const { email, firstName, lastName, password } = values;
    setError(null); // Reset error state before submission
    const { data, error } = await signUp.email({
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
      console.log(data);
      toast.success("Account created successfully");
      router.push("/");
      ``;
    }
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
                      errorMessage={errors.firstName?.message}
                    />
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
                      errorMessage={errors.lastName?.message}
                    />
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
                    errorMessage={errors.email?.message}
                  />
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
                    errorMessage={errors.password?.message}
                    description="Must be at least 10 characters long."
                  />
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
                    errorMessage={errors.confirmPassword?.message}
                  />
                </Field>
              )}
            />

            {error && (
              <FieldError className="font-semibold text-xs">{error}</FieldError>
            )}

            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  Create Account
                </Button>
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

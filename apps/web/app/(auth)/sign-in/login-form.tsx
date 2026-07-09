"use client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/field";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import LabelInputWithAnimation from "@/components/custom/label-animation-input";
import { SignInSchema, signInSchema } from "@/validations/auth-validation";
import Link from "next/link";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
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
    console.log("Form values: ", values);
    try {
      const { data, error } = await signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || "Something went wrong");
      } else {
        console.log(data);
        toast.success("Logged in successfully");
        router.push("/");
      }
    } catch (error) {
      console.error("Error during sign-in:", error);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
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
              {error && (
                <FieldError className="font-semibold text-xs">
                  {error}
                </FieldError>
              )}
              <Field>
                <Link
                  href="/forgot-password"
                  className="inline-block ml-auto text-sm hover:underline underline-offset-4"
                >
                  Forgot your password?
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  Sign in
                </Button>
                <Button variant="outline" type="button">
                  Login with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link href="/sign-up">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

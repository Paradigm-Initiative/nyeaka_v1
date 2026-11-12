import z from "zod";

// Messages are validation error codes. The UI translates them (namespace `validation`).

const passwordRules = z
  .string()
  .min(10, "passwordMin")
  .regex(/[A-Z]/, "passwordUpper")
  .regex(/[a-z]/, "passwordLower")
  .regex(/[0-9]/, "passwordNumber")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "passwordSpecial",
  );

// Sign up schema
export const signUpSchema = z
  .object({
    email: z.string().email("emailInvalid"),
    firstName: z
      .string()
      .min(2, "firstNameMin")
      .max(100, "firstNameMax"),
    lastName: z
      .string()
      .min(2, "lastNameMin")
      .max(100, "lastNameMax"),
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export type SignUpSchema = z.infer<typeof signUpSchema>;

// Sign in schema
export const signInSchema = z.object({
  email: z.string().email("emailInvalid"),
  password: z.string().min(1, "passwordRequired"),
});

export type SignInSchema = z.infer<typeof signInSchema>;

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email("emailInvalid"),
});

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

// Reset password schema
export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordsMismatch",
    path: ["confirmPassword"],
  });

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

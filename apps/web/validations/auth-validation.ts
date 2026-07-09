import z from "zod";

// Sign up schema
export const signUpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters long")
      .max(100, "First name must be less than 100 characters long"),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters long")
      .max(100, "Last name must be less than 100 characters long"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpSchema = z.infer<typeof signUpSchema>;

// Sign in schema
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(10, "Password must be at least 10 characters long"),
});

export type SignInSchema = z.infer<typeof signInSchema>;

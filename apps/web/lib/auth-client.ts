import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import type { auth } from "./auth";

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [nextCookies(), inferAdditionalFields<typeof auth>()],
});

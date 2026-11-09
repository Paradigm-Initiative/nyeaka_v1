import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import type { auth } from "./auth";

export const { signIn, signUp, signOut, useSession } = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [
    emailOTPClient(),
    nextCookies(),
    inferAdditionalFields<typeof auth>(),
  ],
});

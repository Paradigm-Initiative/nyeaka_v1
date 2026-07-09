import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { nextCookies } from "better-auth/next-js";
import { auth } from "./auth";

export const { signIn, signUp, signOut, useSession } = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    emailOTPClient(),
    nextCookies(),
    inferAdditionalFields<typeof auth>(),
  ],
});

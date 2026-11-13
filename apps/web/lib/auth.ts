import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/neon-db";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verificationEmail } from "@/lib/email-templates";
import { prepareNewUser } from "@/lib/country-rules";
import { termsAcceptance } from "@/lib/legal";

// The language saved on the account (see prepareNewUser), for emails sent to this person.
const localeOf = (user: object) => (user as { locale?: string }).locale;

export const auth = betterAuth({
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      // Required at sign-up and checked again below, so it can't be skipped by calling the API directly.
      countryCode: {
        type: "string",
        required: true,
      },
      // The language chosen at sign-up; used for emails sent to this person later.
      locale: {
        type: "string",
        required: false,
      },
      // The sign-up form sends the terms version the person ticked; the hook below checks it and
      // sets termsAcceptedAt. Both must be real columns: better-auth refuses undeclared ones.
      termsVersion: { type: "string", required: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    // A suspended person can't sign in (their sessions are deleted when they are suspended).
    session: {
      create: {
        before: async (session) => {
          const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { suspendedAt: true, deletedAt: true } });
          if (u?.suspendedAt || u?.deletedAt)
            throw new APIError("FORBIDDEN", { message: "This account is suspended.", code: "ACCOUNT_SUSPENDED" });
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          const prepared = await prepareNewUser(user);
          if (!prepared.ok)
            throw new APIError("BAD_REQUEST", {
              message: "Nyeaka isn't available in that country yet.",
              code: prepared.code,
            });
          // Checked here as well as in the form, so calling the API directly can't skip it.
          const terms = termsAcceptance((user as { termsVersion?: unknown }).termsVersion);
          if (!terms)
            throw new APIError("BAD_REQUEST", {
              message: "Please accept the terms and privacy policy.",
              code: "TERMS_NOT_ACCEPTED",
            });
          return {
            data: {
              ...user,
              ...terms,
              name: `${user.firstName} ${user.lastName}`.trim(),
              countryCode: prepared.countryCode,
              locale: prepared.locale,
            },
          };
        },
      },
    },
  },

  // secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      const mail = resetPasswordEmail(user.name.split(" ")[0] || "there", url, localeOf(user));
      try {
        await sendEmail({ to: user.email, ...mail });
      } catch (error) {
        // Swallowed on purpose: surfacing an error here would reveal that the
        // address has an account.
        console.error("Failed to send password reset email", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      const mail = verificationEmail(user.name.split(" ")[0] || "there", url, localeOf(user));
      try {
        await sendEmail({ to: user.email, ...mail });
      } catch (error) {
        console.error("Failed to send verification email", error);
        // On an explicit resend, tell the user. On sign-up/sign-in the account
        // already exists, so let the flow continue to /verify-email where they
        // can resend.
        if (request && new URL(request.url).pathname.endsWith("/send-verification-email")) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "We couldn't send the email. Please try again shortly.",
          });
        }
      }
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [
    "http://localhost:3000",
    "https://nyeaka-v1.vercel.app",
    "https://nyeaka.paradigmhq.org"
    // "https://your-production-domain.com",
  ],
});

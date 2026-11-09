import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/neon-db";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verificationEmail } from "@/lib/email-templates";

// const prisma = new PrismaClient();
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
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              name: `${user.firstName} ${user.lastName}`.trim(),
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
      const mail = resetPasswordEmail(user.name.split(" ")[0] || "there", url);
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
      const mail = verificationEmail(user.name.split(" ")[0] || "there", url);
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

import { betterAuth } from "better-auth";
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
      await sendEmail({ to: user.email, ...mail });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = verificationEmail(user.name.split(" ")[0] || "there", url);
      await sendEmail({ to: user.email, ...mail });
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

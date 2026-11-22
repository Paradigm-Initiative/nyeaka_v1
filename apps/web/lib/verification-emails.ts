import { prisma } from "@/neon-db";
import { appUrl } from "./app-url";
import { sendSafely } from "./notify";
import { verificationApprovedEmail, verificationRejectedEmail } from "./email-templates";

/**
 * Tell the person how their ID review went. Call it AFTER the decision has committed
 * (from `after()` in the action). It never throws: a mail problem must not undo a decision.
 */
export async function emailVerificationDecision(verificationId: string): Promise<void> {
  try {
    const v = await prisma.idVerification.findUnique({
      where: { id: verificationId },
      select: {
        status: true,
        rejectionCode: true,
        rejectionReason: true,
        user: { select: { email: true, firstName: true, locale: true } },
      },
    });
    if (!v) return;
    const { user } = v;
    if (v.status === "VERIFIED") {
      await sendSafely(
        user.email,
        verificationApprovedEmail({ firstName: user.firstName, url: appUrl("/dashboard"), locale: user.locale }),
        "verification approved",
      );
    } else if (v.status === "FAILED") {
      await sendSafely(
        user.email,
        verificationRejectedEmail({
          firstName: user.firstName,
          code: v.rejectionCode,
          reason: v.rejectionReason ?? "",
          url: appUrl("/verify"),
          locale: user.locale,
        }),
        "verification rejected",
      );
    }
  } catch (e) {
    console.error("verification decision: could not prepare email", e);
  }
}

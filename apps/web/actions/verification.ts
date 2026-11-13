"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { submitVerification } from "@/lib/verification";
import { submitVerificationSchema } from "@/validations/verification-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

export async function submitVerificationAction(input: unknown): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "signIn" };
  const parsed = submitVerificationSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "checkFields", fieldErrors: toFieldErrors(parsed.error) };
  try {
    await submitVerification(session.user.id, parsed.data);
    revalidatePath("/verify");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    const res = failure(e, "submitVerificationAction");
    // Show a bad number next to the number field.
    if (res.error === "verifyDocNumber") res.fieldErrors = { docNumber: res.error };
    return res;
  }
}

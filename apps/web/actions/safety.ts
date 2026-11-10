"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { blockUser, reportUser, unblockUser } from "@/lib/safety";
import { reportSchema } from "@/validations/safety-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

const SIGN_IN = "Please sign in first.";

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/listings");
  revalidatePath("/requests");
}

export async function reportAction(input: unknown): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: toFieldErrors(parsed.error) };
  try {
    await reportUser(session.user.id, parsed.data);
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "reportAction");
  }
}

export async function blockUserAction(userId: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await blockUser(session.user.id, userId);
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "blockUserAction");
  }
}

export async function unblockUserAction(userId: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await unblockUser(session.user.id, userId);
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "unblockUserAction");
  }
}

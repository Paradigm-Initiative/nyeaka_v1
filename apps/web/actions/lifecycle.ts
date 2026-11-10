"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { confirmHandoff, setPhoneShare } from "@/lib/handoff";
import { rateMatch, rateSchema } from "@/lib/ratings";
import { sharePhoneSchema } from "@/validations/lifecycle-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

const SIGN_IN = "Please sign in first.";

/** Opt in or out of sharing your number. The thread re-fetches itself afterwards. */
export async function sharePhoneAction(matchId: string, input: unknown): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = sharePhoneSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the phone number.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    await setPhoneShare(session.user.id, matchId, parsed.data.share, parsed.data.phone);
    return { ok: true, data: undefined };
  } catch (e) {
    const res = failure(e, "sharePhoneAction");
    // Show a bad-number message next to the field.
    return !res.ok && /phone number/i.test(res.error) ? { ...res, fieldErrors: { phone: res.error } } : res;
  }
}

export async function confirmHandoffAction(matchId: string): Promise<ActionResult<{ handedOver: boolean }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    const res = await confirmHandoff(session.user.id, matchId);
    if (res.handedOver) {
      // The completed-handoff count and "rate" prompts live on these pages.
      revalidatePath("/dashboard");
    }
    return { ok: true, data: res };
  } catch (e) {
    return failure(e, "confirmHandoffAction");
  }
}

export async function rateMatchAction(matchId: string, input: unknown): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: toFieldErrors(parsed.error) };
  try {
    await rateMatch(session.user.id, matchId, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "rateMatchAction");
  }
}

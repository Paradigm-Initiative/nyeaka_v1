"use server";

import { getServerSession } from "@/lib/get-session";
import { sendMessage } from "@/lib/messages";
import { sendMessageSchema } from "@/validations/message-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

export async function sendMessageAction(
  conversationId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Please sign in first." };
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message, fieldErrors: toFieldErrors(parsed.error) };
  try {
    await sendMessage(session.user.id, conversationId, parsed.data);
    // No revalidatePath: the open thread re-fetches itself (router.refresh) right after.
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "sendMessageAction");
  }
}

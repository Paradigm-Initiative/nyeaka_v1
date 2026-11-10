"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { acceptOffer, cancelMatch, declineOffer } from "@/lib/matches";
import { failure, type ActionResult } from "@/lib/action-result";

const SIGN_IN = "Please sign in first.";

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/listings");
  revalidatePath("/requests");
}

export async function acceptOfferAction(
  offerId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    const result = await acceptOffer(session.user.id, offerId);
    revalidate();
    // TODO(step 7): send "offer accepted" to result.offerSenderId and
    // "not selected" emails to result.notSelected, after this commit, never failing the action.
    return { ok: true, data: { conversationId: result.conversationId } };
  } catch (e) {
    return failure(e, "acceptOfferAction");
  }
}

export async function declineOfferAction(offerId: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await declineOffer(session.user.id, offerId);
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "declineOfferAction");
  }
}

export async function cancelMatchAction(matchId: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await cancelMatch(session.user.id, matchId);
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "cancelMatchAction");
  }
}

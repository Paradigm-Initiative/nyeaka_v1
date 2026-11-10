"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { createOffer, withdrawOffer } from "@/lib/offers";
import { createOfferSchema } from "@/validations/offer-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";
import { emailOfferReceived } from "@/lib/offer-emails";

const SIGN_IN = "Please sign in first.";

function revalidate(listingId?: string, requestId?: string) {
  revalidatePath("/dashboard");
  if (listingId) revalidatePath(`/listings/${listingId}`);
  if (requestId) revalidatePath(`/requests/${requestId}`);
}

export async function createOfferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = createOfferSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    const { id } = await createOffer(session.user.id, parsed.data);
    revalidate(parsed.data.listingId, parsed.data.requestId);
    after(() => emailOfferReceived(id));
    return { ok: true, data: { id } };
  } catch (e) {
    return failure(e, "createOfferAction");
  }
}

export async function withdrawOfferAction(offerId: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await withdrawOffer(session.user.id, offerId);
    revalidate();
    revalidatePath("/listings/[listing]", "page");
    revalidatePath("/requests/[request]", "page");
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "withdrawOfferAction");
  }
}

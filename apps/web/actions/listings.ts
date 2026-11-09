"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { createListing, updateListing, closeListing, renewListing } from "@/lib/listings";
import { createListingSchema } from "@/validations/post-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

function revalidate(id?: string) {
  revalidatePath("/listings");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/listings/${id}`);
  revalidatePath("/");
}

const SIGN_IN = "Please sign in first.";

export async function createListingAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    const { id } = await createListing(session.user.id, parsed.data);
    revalidate();
    return { ok: true, data: { id } };
  } catch (e) {
    return failure(e, "createListingAction");
  }
}

export async function updateListingAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    await updateListing(session.user.id, id, parsed.data);
    revalidate(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return failure(e, "updateListingAction");
  }
}

export async function closeListingAction(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await closeListing(session.user.id, id);
    revalidate(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "closeListingAction");
  }
}

export async function renewListingAction(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await renewListing(session.user.id, id);
    revalidate(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "renewListingAction");
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { createListing } from "@/lib/listings";
import { ServiceError } from "@/lib/errors";
import { createListingSchema } from "@/validations/post-validation";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";

export async function createListingAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Please sign in to list a device." };

  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const { id } = await createListing(session.user.id, parsed.data);
    revalidatePath("/listings");
    revalidatePath("/");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof ServiceError && e.code === "INVALID") return { ok: false, error: e.message, fieldErrors: { photos: e.message } };
    console.error("createListingAction", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

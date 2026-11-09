"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { createRequest } from "@/lib/requests";
import { createRequestSchema } from "@/validations/post-validation";
import type { ActionResult } from "@/lib/action-result";
import { toFieldErrors } from "@/lib/action-result";

export async function createRequestAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Please sign in to post a request." };

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };

  try {
    const { id } = await createRequest(session.user.id, parsed.data);
    revalidatePath("/requests");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("createRequestAction", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { createRequest, updateRequest, closeRequest, renewRequest } from "@/lib/requests";
import { createRequestSchema } from "@/validations/post-validation";
import { failure, toFieldErrors, type ActionResult } from "@/lib/action-result";

function revalidate(id?: string) {
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/requests/${id}`);
  
}

const SIGN_IN = "Please sign in first.";

export async function createRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    const { id } = await createRequest(session.user.id, parsed.data);
    revalidate();
    return { ok: true, data: { id } };
  } catch (e) {
    return failure(e, "createRequestAction");
  }
}

export async function updateRequestAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  try {
    await updateRequest(session.user.id, id, parsed.data);
    revalidate(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return failure(e, "updateRequestAction");
  }
}

export async function closeRequestAction(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await closeRequest(session.user.id, id);
    revalidate(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "closeRequestAction");
  }
}

export async function renewRequestAction(id: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: SIGN_IN };
  try {
    await renewRequest(session.user.id, id);
    revalidate(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "renewRequestAction");
  }
}

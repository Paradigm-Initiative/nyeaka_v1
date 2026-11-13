"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { setCountryEnabled } from "@/lib/admin";
import { approveVerification, rejectVerification, revealVerificationImages } from "@/lib/verification";
import { emailVerificationDecision } from "@/lib/verification-emails";
import { ServiceError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

// Admin screens are English only, so errors here are plain English for the admin
// (unlike user-facing actions, which return translation keys). Every service called here
// re-checks the admin role itself; the proxy and layout are not the only guard.
async function run<T = undefined>(label: string, work: (adminId: string) => Promise<T | void>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Please sign in." };
  try {
    return { ok: true, data: (await work(session.user.id)) as T };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error(label, e);
    return { ok: false, error: "Something went wrong." };
  }
}

export async function setCountryEnabledAction(code: string, enabled: boolean): Promise<ActionResult> {
  return run<undefined>("setCountryEnabledAction", async (adminId) => {
    await setCountryEnabled(adminId, code, enabled);
    revalidatePath("/admin/countries");
    revalidatePath("/admin/log");
    revalidatePath("/sign-up");
  });
}

function afterDecision(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${id}`);
  revalidatePath("/admin/log");
  revalidatePath("/dashboard");
  // After the response, so a mail problem can't undo or slow the decision.
  after(() => emailVerificationDecision(id));
}

export async function approveVerificationAction(id: string): Promise<ActionResult> {
  return run<undefined>("approveVerificationAction", async (adminId) => {
    await approveVerification(adminId, id);
    afterDecision(id);
  });
}

export async function rejectVerificationAction(id: string, reason: string): Promise<ActionResult> {
  return run<undefined>("rejectVerificationAction", async (adminId) => {
    await rejectVerification(adminId, id, reason);
    afterDecision(id);
  });
}

/** Signed image URLs for the review page. Each call is logged. */
export async function viewVerificationImagesAction(id: string) {
  return run("viewVerificationImagesAction", (adminId) => revealVerificationImages(adminId, id));
}

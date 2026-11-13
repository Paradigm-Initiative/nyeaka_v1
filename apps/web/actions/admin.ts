"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { setCountryEnabled } from "@/lib/admin";
import { ServiceError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

// Admin screens are English only, so errors here are plain English for the admin
// (unlike user-facing actions, which return translation keys).
export async function setCountryEnabledAction(code: string, enabled: boolean): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Please sign in." };
  try {
    await setCountryEnabled(session.user.id, code, enabled);
    revalidatePath("/admin/countries");
    revalidatePath("/sign-up");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("setCountryEnabledAction", e);
    return { ok: false, error: "Something went wrong." };
  }
}

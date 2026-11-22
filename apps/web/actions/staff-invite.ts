"use server";

import { acceptInvite } from "@/lib/staff-invites";
import { ServiceError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

// Public on purpose (the invitee has no account yet); the 256-bit token is the credential.
// English only, like the rest of the staff area.
export async function acceptInviteAction(
  token: string,
  input: { firstName: string; lastName: string; password: string },
): Promise<ActionResult<{ promoted: boolean }>> {
  try {
    const r = await acceptInvite(String(token ?? ""), {
      firstName: String(input?.firstName ?? ""), lastName: String(input?.lastName ?? ""), password: String(input?.password ?? ""),
    });
    return { ok: true, data: { promoted: r.promoted } };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("acceptInviteAction", e);
    return { ok: false, error: "Something went wrong." };
  }
}

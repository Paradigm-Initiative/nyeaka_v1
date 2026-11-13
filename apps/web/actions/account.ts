"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";
import { deleteAccount } from "@/lib/account";
import { failure, type ActionResult } from "@/lib/action-result";

export async function deleteAccountAction(confirmEmail: string): Promise<ActionResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "signIn" };
  try {
    await deleteAccount(session.user.id, confirmEmail);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return failure(e, "deleteAccountAction");
  }
}

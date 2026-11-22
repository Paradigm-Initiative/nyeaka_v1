"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { setCountryEnabled, type StaffRole } from "@/lib/admin";
import { setStaffRole, resetTwoFactor } from "@/lib/staff";
import { inviteStaff, revokeInvite, INVITE_TTL_HOURS } from "@/lib/staff-invites";
import { staffInviteEmail } from "@/lib/email-templates";
import { sendSafely } from "@/lib/notify";
import { prisma } from "@/neon-db";
import { dismissReport, closeReportedPost, suspendUser, unsuspendUser, liftUserRestriction } from "@/lib/moderation";
import { approveVerification, rejectVerification, revealVerificationImages } from "@/lib/verification";
import { overturnVerification } from "@/lib/verification-audit";
import { claimVerification, releaseVerification } from "@/lib/verification-claims";
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

function afterDecision(id: string, final: boolean) {
  revalidatePath("/admin");
  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${id}`);
  revalidatePath("/admin/log");
  if (!final) return; // only a first decision: nothing changes for the applicant yet
  revalidatePath("/dashboard");
  // After the response, so a mail problem can't undo or slow the decision.
  after(() => emailVerificationDecision(id));
}

/** `final: false` means a matching document needs a second reviewer; nothing was sent to the applicant. */
export async function approveVerificationAction(id: string): Promise<ActionResult<{ final: boolean }>> {
  return run<{ final: boolean }>("approveVerificationAction", async (adminId) => {
    const d = await approveVerification(adminId, id);
    afterDecision(id, d.final);
    return { final: d.final };
  });
}

export async function rejectVerificationAction(id: string, code: string, note?: string): Promise<ActionResult<{ final: boolean }>> {
  return run<{ final: boolean }>("rejectVerificationAction", async (adminId) => {
    const d = await rejectVerification(adminId, id, code, note);
    afterDecision(id, d.final);
    return { final: d.final };
  });
}

/** Opening a case claims it (15 minutes, renewed by activity). */
export async function claimVerificationAction(id: string): Promise<ActionResult> {
  return run<undefined>("claimVerificationAction", async (adminId) => {
    await claimVerification(adminId, id);
    revalidatePath("/admin/verifications");
  });
}

export async function releaseVerificationAction(id: string): Promise<ActionResult> {
  return run<undefined>("releaseVerificationAction", async (adminId) => {
    await releaseVerification(adminId, id);
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/verifications/${id}`);
  });
}

/** Signed image URLs for the review page. Each call is logged. */
export async function viewVerificationImagesAction(id: string) {
  return run("viewVerificationImagesAction", (adminId) => revealVerificationImages(adminId, id));
}

function afterModeration() {
  revalidatePath("/admin/reports");
  revalidatePath("/admin/log");
  revalidatePath("/admin");
}

export async function dismissReportAction(id: string, note?: string): Promise<ActionResult> {
  return run<undefined>("dismissReportAction", async (adminId) => {
    await dismissReport(adminId, id, note);
    afterModeration();
  });
}

export async function closeReportedPostAction(id: string): Promise<ActionResult> {
  return run<undefined>("closeReportedPostAction", async (adminId) => {
    await closeReportedPost(adminId, id);
    revalidatePath("/listings");
    revalidatePath("/requests");
    afterModeration();
  });
}

export async function suspendUserAction(userId: string, reason: string): Promise<ActionResult> {
  return run<undefined>("suspendUserAction", async (adminId) => {
    await suspendUser(adminId, userId, reason);
    revalidatePath("/listings");
    revalidatePath("/requests");
    afterModeration();
  });
}

export async function unsuspendUserAction(userId: string): Promise<ActionResult> {
  return run<undefined>("unsuspendUserAction", async (adminId) => {
    await unsuspendUser(adminId, userId);
    afterModeration();
  });
}

export async function liftRestrictionAction(userId: string): Promise<ActionResult> {
  return run<undefined>("liftRestrictionAction", async (adminId) => {
    await liftUserRestriction(adminId, userId);
    afterModeration();
  });
}

function afterStaffChange() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin/log");
}

/**
 * Invite someone to the staff. The link is emailed; if the email can't be sent the link is
 * returned so the admin can pass it on themselves (it is shown once and not stored).
 */
export async function inviteStaffAction(email: string, role: StaffRole): Promise<ActionResult<{ emailed: boolean; url: string | null }>> {
  return run<{ emailed: boolean; url: string | null }>("inviteStaffAction", async (adminId) => {
    const inv = await inviteStaff(adminId, email, role);
    const inviter = await prisma.user.findUniqueOrThrow({ where: { id: adminId }, select: { name: true } });
    const emailed = await sendSafely(
      inv.email,
      staffInviteEmail({ role: inv.role, inviterName: inviter.name, url: inv.url, hours: INVITE_TTL_HOURS }),
      "staff invite",
    );
    afterStaffChange();
    return { emailed, url: emailed ? null : inv.url };
  });
}

export async function revokeInviteAction(id: string): Promise<ActionResult> {
  return run<undefined>("revokeInviteAction", async (adminId) => {
    await revokeInvite(adminId, id);
    afterStaffChange();
  });
}

/** role = null removes staff access and ends their sessions straight away. */
export async function setStaffRoleAction(userId: string, role: StaffRole | null): Promise<ActionResult> {
  return run<undefined>("setStaffRoleAction", async (adminId) => {
    await setStaffRole(adminId, userId, role);
    afterStaffChange();
  });
}

export async function resetTwoFactorAction(userId: string): Promise<ActionResult> {
  return run<undefined>("resetTwoFactorAction", async (adminId) => {
    await resetTwoFactor(adminId, userId);
    afterStaffChange();
  });
}

/** Admin only: send a decided case back to the queue (or, if its images are gone, back to "not verified"). */
export async function overturnVerificationAction(id: string, note: string): Promise<ActionResult<{ reopened: boolean }>> {
  return run<{ reopened: boolean }>("overturnVerificationAction", async (adminId) => {
    const r = await overturnVerification(adminId, id, note);
    revalidatePath("/admin");
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/verifications/${id}`);
    revalidatePath("/admin/decisions");
    revalidatePath("/admin/log");
    revalidatePath("/dashboard");
    revalidatePath("/verify");
    return r;
  });
}

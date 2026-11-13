import { createHmac } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { assertAdmin, logAdminAction } from "./admin";
import { getCountryConfig } from "./countries";
import { idObjectsExist, isOwnIdKey, presignIdView, VIEW_TTL_SECONDS } from "./storage-private";
import type { SubmitVerificationData } from "@/validations/verification-validation";

// Messages below that users can see are mapped to translation keys in lib/error-keys.ts.
// Admin-only messages are plain English (the admin area is English only).
export const NOT_VERIFIED = "Verify your identity first to post, request or send offers.";
export const VERIFY_PENDING = "Your verification is already being reviewed.";
export const VERIFY_ALREADY = "Your identity is already verified.";
export const VERIFY_DOC_TYPE = "That document isn't accepted in your country.";
export const VERIFY_DOC_NUMBER = "Enter a valid ID number.";
export const VERIFY_IMAGES = "Upload the required ID photos.";
export const VERIFY_EXPIRED = "The ID has expired. Use one that is still valid.";
export const VERIFY_COUNTRY = "Nyeaka isn't available in your country yet.";

/** Images are kept this long after a decision, then deleted (see the purge job). */
export const IMAGE_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/** Posting, requesting and offering all need a verified identity. Enforced here, never only in the UI. */
export async function assertVerified(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { idVerificationStatus: true } });
  if (u?.idVerificationStatus !== "VERIFIED") throw new ServiceError("FORBIDDEN", NOT_VERIFIED);
}

/** Upper-case letters and digits only, so "a12-345 678" and "A12345678" hash the same. */
export const normalizeDocNumber = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * HMAC of a document number (key: ID_HASH_SECRET). The number is never stored; the hash
 * only lets a reviewer see that the same document was used on another account.
 */
export function hashDocNumber(countryCode: string, documentType: string, docNumber: string): string {
  const secret = process.env.ID_HASH_SECRET;
  if (!secret || secret.length < 16) throw new Error("ID_HASH_SECRET is not set (min 16 characters)");
  return createHmac("sha256", secret)
    .update(`${countryCode}|${documentType}|${normalizeDocNumber(docNumber)}`)
    .digest("hex");
}

/** Documents with a back side. Only a passport is a single page. */
const needsBack = (documentType: string) => documentType !== "PASSPORT";

export async function submitVerification(userId: string, input: SubmitVerificationData) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { countryCode: true, idVerificationStatus: true },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "User not found");
  if (user.idVerificationStatus === "VERIFIED") throw new ServiceError("INVALID", VERIFY_ALREADY);
  if (user.idVerificationStatus === "PENDING") throw new ServiceError("INVALID", VERIFY_PENDING);

  const config = getCountryConfig(user.countryCode);
  if (!config) throw new ServiceError("INVALID", VERIFY_COUNTRY);
  if (!config.idDocTypes.includes(input.documentType)) throw new ServiceError("INVALID", VERIFY_DOC_TYPE);

  const number = normalizeDocNumber(input.docNumber);
  const rule = config.idNumber?.docType === input.documentType ? config.idNumber.pattern : null;
  if (number.length < 5 || number.length > 25 || (rule && !rule.test(number)))
    throw new ServiceError("INVALID", VERIFY_DOC_NUMBER);

  const back = input.backKey || undefined;
  const keys = [input.frontKey, input.selfieKey, ...(back ? [back] : [])];
  if (!keys.every((k) => isOwnIdKey(userId, k)) || new Set(keys).size !== keys.length)
    throw new ServiceError("INVALID", VERIFY_IMAGES);
  if (needsBack(input.documentType) && !back) throw new ServiceError("INVALID", VERIFY_IMAGES);
  // The files must really be in the private bucket, not just keys that look right.
  if (!(await idObjectsExist(keys))) throw new ServiceError("INVALID", VERIFY_IMAGES);

  let docExpiry: Date | undefined;
  if (input.docExpiry) {
    docExpiry = new Date(`${input.docExpiry}T00:00:00.000Z`);
    if (docExpiry.getTime() < Date.now()) throw new ServiceError("INVALID", VERIFY_EXPIRED);
  }

  const docNumberHash = hashDocNumber(user.countryCode, input.documentType, number);

  try {
    return await prisma.$transaction(async (tx) => {
      // The status guard repeats the check above, so two quick submits can't both pass.
      const moved = await tx.user.updateMany({
        where: { id: userId, idVerificationStatus: { in: ["NONE", "FAILED"] } },
        data: { idVerificationStatus: "PENDING" },
      });
      if (moved.count === 0) throw new ServiceError("INVALID", VERIFY_PENDING);
      return tx.idVerification.create({
        data: {
          userId,
          countryCode: user.countryCode,
          documentType: input.documentType,
          fullNameOnId: input.fullNameOnId,
          docExpiry,
          docNumberHash,
          frontKey: input.frontKey,
          backKey: back ?? null,
          selfieKey: input.selfieKey,
        },
        select: { id: true },
      });
    });
  } catch (e) {
    // The one-PENDING-per-user partial unique index is the last line of defence.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ServiceError("INVALID", VERIFY_PENDING);
    throw e;
  }
}

type Decision = { userId: string; countryCode: string };

async function decide(
  adminId: string,
  verificationId: string,
  outcome: "VERIFIED" | "FAILED",
  reason?: string,
): Promise<Decision> {
  await assertAdmin(adminId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.idVerification.findUnique({
      where: { id: verificationId },
      select: { userId: true, countryCode: true },
    });
    if (!row) throw new ServiceError("NOT_FOUND", "Verification not found.");
    if (row.userId === adminId) throw new ServiceError("FORBIDDEN", "You can't review your own verification.");

    const now = new Date();
    // Only a PENDING row can be decided, and only once, even if two admins click together.
    const done = await tx.idVerification.updateMany({
      where: { id: verificationId, status: "PENDING" },
      data: {
        status: outcome,
        rejectionReason: outcome === "FAILED" ? reason : null,
        reviewedById: adminId,
        decidedAt: now,
        imagesPurgeAt: new Date(now.getTime() + IMAGE_RETENTION_DAYS * DAY_MS),
      },
    });
    if (done.count === 0) throw new ServiceError("INVALID", "This submission has already been decided.");

    await tx.user.update({ where: { id: row.userId }, data: { idVerificationStatus: outcome } });
    await logAdminAction(tx, {
      actorId: adminId,
      action: outcome === "VERIFIED" ? "id.approve" : "id.reject",
      targetType: "IdVerification",
      targetId: verificationId,
      reason,
      meta: { userId: row.userId, countryCode: row.countryCode },
    });
    return row;
  });
}

export const approveVerification = (adminId: string, verificationId: string) =>
  decide(adminId, verificationId, "VERIFIED");

export async function rejectVerification(adminId: string, verificationId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new ServiceError("INVALID", "A rejection reason is required.");
  return decide(adminId, verificationId, "FAILED", trimmed.slice(0, 500));
}

/**
 * Short-lived signed URLs for the ID images, for an admin who is about to review them.
 * Every call is logged (who looked at whose documents and when). Not possible once the
 * images are purged, and never for your own documents.
 */
export async function revealVerificationImages(adminId: string, verificationId: string) {
  await assertAdmin(adminId);
  const row = await prisma.idVerification.findUnique({
    where: { id: verificationId },
    select: { userId: true, frontKey: true, backKey: true, selfieKey: true, imagesPurgedAt: true },
  });
  if (!row) throw new ServiceError("NOT_FOUND", "Verification not found.");
  if (row.userId === adminId) throw new ServiceError("FORBIDDEN", "You can't review your own verification.");
  if (row.imagesPurgedAt || !row.frontKey || !row.selfieKey)
    throw new ServiceError("INVALID", "These images have been deleted.");

  // Log first: if signing fails nothing was shown, and if it succeeds the view is on record.
  await logAdminAction(prisma, {
    actorId: adminId,
    action: "id.view_images",
    targetType: "IdVerification",
    targetId: verificationId,
    meta: { userId: row.userId },
  });
  const [front, back, selfie] = await Promise.all([
    presignIdView(row.frontKey),
    row.backKey ? presignIdView(row.backKey) : Promise.resolve(null),
    presignIdView(row.selfieKey),
  ]);
  return { front, back, selfie, expiresInSeconds: VIEW_TTL_SECONDS };
}

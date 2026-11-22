import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { cancelAllActiveMatchesOf } from "./matches";
import { deleteIdObjects } from "./storage-private";
import { HASH_RETENTION_MONTHS, retainDocumentHashes } from "./moderation";

// Mapped to translation keys in lib/error-keys.ts.
export const DELETE_ADMIN = "Staff can't delete their account here. Ask an admin to remove your staff access first.";
export const DELETE_CONFIRM = "Type your email address to confirm.";

/**
 * Delete a person's account. The row is anonymised in place, not removed: matches,
 * messages the other person wrote to them, ratings and the admin log keep working, but
 * nothing identifies the person any more.
 *
 * Gone: sign-in (sessions, credentials, email-verification tokens), email, name, phone,
 * photo, bio, ID submissions and their images, blocks. Closed: their live posts, active
 * matches (freeing the other side) and pending offers. Kept: reports about or by them
 * (safety), and, only for someone an admin suspended, the ID-document hash for 12 months.
 *
 * ID images are deleted from storage first; if that fails nothing else happens and the
 * person can try again.
 */
export async function deleteAccount(userId: string, confirmEmail: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, staffRole: true, deletedAt: true, suspendedAt: true },
  });
  if (!u || u.deletedAt) throw new ServiceError("NOT_FOUND", "User not found");
  if (u.staffRole) throw new ServiceError("FORBIDDEN", DELETE_ADMIN);
  if (confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()) throw new ServiceError("INVALID", DELETE_CONFIRM);

  const submissions = await prisma.idVerification.findMany({
    where: { userId },
    select: { frontKey: true, backKey: true, selfieKey: true },
  });
  const keys = submissions.flatMap((s) => [s.frontKey, s.backKey, s.selfieKey]).filter((k): k is string => !!k);
  if (keys.length) await deleteIdObjects(keys);

  const now = new Date();
  const hashExpiry = new Date(now);
  hashExpiry.setUTCMonth(hashExpiry.getUTCMonth() + HASH_RETENTION_MONTHS);

  await prisma.$transaction(async (tx) => {
    if (u.suspendedAt) await retainDocumentHashes(tx, userId, hashExpiry);
    await tx.idVerification.deleteMany({ where: { userId } });

    await tx.listing.updateMany({ where: { donorId: userId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    await tx.request.updateMany({ where: { requesterId: userId, status: { in: ["ACTIVE", "MATCHED"] } }, data: { status: "CLOSED" } });
    await cancelAllActiveMatchesOf(tx, userId);
    await tx.offer.updateMany({ where: { status: "PENDING", initiatedById: userId }, data: { status: "WITHDRAWN" } });
    await tx.offer.updateMany({
      where: { status: "PENDING", OR: [{ donorId: userId }, { request: { requesterId: userId } }] },
      data: { status: "DECLINED" },
    });

    await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({ where: { identifier: u.email } });

    await tx.user.update({
      where: { id: userId },
      data: {
        // Unique and unroutable, so the real address can be used to sign up again.
        email: `deleted-${userId}@deleted.invalid`,
        emailVerified: false,
        firstName: "Deleted",
        lastName: "user",
        name: "Deleted user",
        image: null,
        phone: null,
        phoneVerified: false,
        bio: null,
        idVerificationStatus: "NONE",
        restrictedReason: null,
        suspendedReason: null,
        deletedAt: now,
      },
    });
    // Nobody keeps a phone number from a person who is gone.
    await tx.match.updateMany({ where: { OR: [{ donorId: userId }, { requesterId: userId }] }, data: { donorSharedPhone: false, requesterSharedPhone: false } });
  });
}

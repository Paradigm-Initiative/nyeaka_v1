import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";
import { normalizePhone } from "./phone";

/** The two people in a match, or throws. `role` says which one the caller is. */
async function loadParticipant(userId: string, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      donorId: true,
      requesterId: true,
      donor: { select: { phone: true } },
      requester: { select: { phone: true } },
    },
  });
  if (!match) throw new ServiceError("NOT_FOUND", "Match not found");
  const role = match.donorId === userId ? "donor" : match.requesterId === userId ? "requester" : null;
  if (!role) throw new ServiceError("FORBIDDEN", "You are not part of this match");
  const otherId = role === "donor" ? match.requesterId : match.donorId;
  return { match, role, otherId } as const;
}

async function assertNotBlocked(a: string, b: string) {
  const n = await prisma.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  if (n > 0) throw new ServiceError("INVALID", "You can't do that in this conversation.");
}

/**
 * Opt in (or back out) of sharing your phone number with the other person.
 * Numbers are only revealed when BOTH have opted in. If you have no number on
 * file, pass one and it is saved to your account (unverified).
 */
export async function setPhoneShare(
  userId: string,
  matchId: string,
  share: boolean,
  phone?: string,
): Promise<{ shared: boolean }> {
  const { match, role, otherId } = await loadParticipant(userId, matchId);
  if (match.status === "CANCELLED")
    throw new ServiceError("INVALID", "This match was cancelled, so numbers can't be shared.");
  await assertNotBlocked(userId, otherId);

  const field = role === "donor" ? "donorSharedPhone" : "requesterSharedPhone";
  if (!share) {
    await prisma.match.update({ where: { id: matchId }, data: { [field]: false } });
    return { shared: false };
  }

  const onFile = (role === "donor" ? match.donor.phone : match.requester.phone) ?? null;
  const number = phone?.trim() ? normalizePhone(phone) : onFile;
  if (!number) throw new ServiceError("INVALID", "Add your phone number to share it.");

  await prisma.$transaction(async (tx) => {
    if (number !== onFile)
      await tx.user.update({ where: { id: userId }, data: { phone: number, phoneVerified: false } });
    await tx.match.update({ where: { id: matchId }, data: { [field]: true } });
  });
  return { shared: true };
}

/**
 * Say the device has changed hands. When both people have confirmed, the match
 * becomes HANDED_OVER (which opens ratings). Confirming twice is harmless.
 */
export async function confirmHandoff(userId: string, matchId: string): Promise<{ handedOver: boolean }> {
  const { match, role } = await loadParticipant(userId, matchId);
  if (match.status === "HANDED_OVER") return { handedOver: true };
  if (match.status === "CANCELLED")
    throw new ServiceError("INVALID", "This match was cancelled, so there is nothing to confirm.");

  return prisma.$transaction(async (tx) => {
    const own = role === "donor" ? "donorConfirmedAt" : "requesterConfirmedAt";
    await tx.match.updateMany({ where: { id: matchId, [own]: null }, data: { [own]: new Date() } });

    const now = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { donorConfirmedAt: true, requesterConfirmedAt: true },
    });
    if (!now.donorConfirmedAt || !now.requesterConfirmedAt) return { handedOver: false };

    // Conditional, so the second of two simultaneous confirms is a no-op.
    await tx.match.updateMany({
      where: { id: matchId, status: "ACTIVE" },
      data: { status: "HANDED_OVER", handedOverAt: new Date() },
    });
    return { handedOver: true };
  });
}

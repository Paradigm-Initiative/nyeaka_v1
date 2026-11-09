import { prisma } from "@/neon-db";
import { ServiceError } from "./errors";

export type OwnedKind = "listing" | "request";

/** Throws NOT_FOUND if the record is missing, FORBIDDEN if userId is not the owner. */
export async function assertOwner(
  kind: OwnedKind,
  id: string,
  userId: string,
): Promise<void> {
  const ownerId =
    kind === "listing"
      ? (
          await prisma.listing.findUnique({
            where: { id },
            select: { donorId: true },
          })
        )?.donorId
      : (
          await prisma.request.findUnique({
            where: { id },
            select: { requesterId: true },
          })
        )?.requesterId;

  if (!ownerId) throw new ServiceError("NOT_FOUND", `${kind} not found`);
  if (ownerId !== userId)
    throw new ServiceError("FORBIDDEN", `You do not own this ${kind}`);
}

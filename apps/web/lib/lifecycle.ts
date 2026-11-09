import type { RequestOfferStatus } from "@/generated/prisma/enums";
import { ServiceError } from "./errors";

export type PostState = "ACTIVE" | "EXPIRED" | "CLOSED" | "MATCHED";

/** Nothing flips status to EXPIRED automatically, so an ACTIVE post past expiresAt is expired. */
export function postState(
  status: RequestOfferStatus,
  expiresAt: Date,
  now: Date = new Date(),
): PostState {
  if (status === "CLOSED" || status === "MATCHED") return status;
  if (status === "EXPIRED" || expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

export function assertState(
  state: PostState,
  allowed: PostState[],
  message: string,
): void {
  if (!allowed.includes(state)) throw new ServiceError("INVALID", message);
}

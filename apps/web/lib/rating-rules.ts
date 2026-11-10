/** Ratings stay open this long after a match ends. */
export const RATING_WINDOW_DAYS = 30;
export const RATING_COMMENT_MAX = 500;

export type MatchStatus = "ACTIVE" | "HANDED_OVER" | "CANCELLED";

export interface RatingContext {
  status: MatchStatus;
  /** When the match ended: handedOverAt, cancelledAt, or (for old rows) updatedAt. */
  endedAt: Date;
  /** Both people sent at least one message. */
  bothMessaged: boolean;
  /** Either person has blocked the other. */
  blocked: boolean;
  alreadyRated: boolean;
  now?: Date;
}

export type RatingVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Ratings open when the device has changed hands, or when a match was
 * cancelled but the two people really did talk (so a cancel in the first
 * minute can't be used to leave a 1-star over nothing). Never after a block.
 */
export function ratingVerdict(c: RatingContext): RatingVerdict {
  const now = c.now ?? new Date();
  if (c.alreadyRated) return { ok: false, reason: "You've already rated this match." };
  if (c.blocked) return { ok: false, reason: "Ratings aren't available for this match." };
  if (c.status === "ACTIVE") return { ok: false, reason: "You can rate once the handoff is confirmed or the match ends." };
  if (c.status === "CANCELLED" && !c.bothMessaged)
    return { ok: false, reason: "Ratings open after a cancelled match only if you both exchanged messages." };
  const closes = c.endedAt.getTime() + RATING_WINDOW_DAYS * 86_400_000;
  if (now.getTime() > closes) return { ok: false, reason: "The rating window for this match has closed." };
  return { ok: true };
}

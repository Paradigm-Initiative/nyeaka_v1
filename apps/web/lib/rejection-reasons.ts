// Preset reasons for rejecting an ID check. The reviewer picks one; the applicant is emailed
// (and /verify shows) the pre-written text for it in their language: `emails.verificationRejected.reasons.<CODE>`
// and `verify.rejectReasons.<CODE>` in messages/*.json. Add a code here and in all three catalogues.

export const REJECTION_CODES = ["BLURRY", "EXPIRED", "NAME_MISMATCH", "UNSUPPORTED_DOC", "SELFIE_MISMATCH"] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export const isRejectionCode = (v: unknown): v is RejectionCode => REJECTION_CODES.includes(v as RejectionCode);

/** Reviewer-facing labels (the admin area is English only). */
export const REJECTION_LABEL: Record<RejectionCode, string> = {
  BLURRY: "Image blurry or unreadable",
  EXPIRED: "Document expired",
  NAME_MISMATCH: "Name doesn't match the account",
  UNSUPPORTED_DOC: "Unsupported document",
  SELFIE_MISMATCH: "Selfie doesn't match the document",
};

export const NOTE_MAX = 500;

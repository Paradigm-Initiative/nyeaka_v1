import { z } from "zod";
import { IdDocumentType } from "@/generated/prisma/enums";

// Messages are keys in the `validation` namespace. Country-specific rules (accepted
// documents, ID-number format) are checked in lib/verification.ts, which knows the country.
export const submitVerificationSchema = z.object({
  documentType: z.enum(IdDocumentType, { error: "chooseDocType" }),
  fullNameOnId: z.string().trim().min(2, "enterFullName").max(120, "enterFullName"),
  docNumber: z.string().trim().min(1, "enterDocNumber").max(40, "enterDocNumber"),
  // An optional date, YYYY-MM-DD (empty string means "not given").
  docExpiry: z
    .union([z.literal(""), z.iso.date("invalidDate")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  frontKey: z.string().min(1, "uploadFront"),
  backKey: z.string().optional(),
  selfieKey: z.string().min(1, "uploadSelfie"),
});

export type SubmitVerificationInput = z.input<typeof submitVerificationSchema>;
export type SubmitVerificationData = z.output<typeof submitVerificationSchema>;

export const rejectVerificationSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required.").max(500, "Keep the reason under 500 characters."),
});

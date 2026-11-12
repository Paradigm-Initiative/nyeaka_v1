import { z } from "zod";

export const createOfferSchema = z.object({
  listingId: z.string().min(1, "chooseDevice"),
  requestId: z.string().min(1, "chooseRequest"),
  message: z
    .string()
    .trim()
    .max(1000, "noteTooLong")
    .optional()
    .transform((v) => v || undefined),
});

export type CreateOfferInput = z.input<typeof createOfferSchema>;

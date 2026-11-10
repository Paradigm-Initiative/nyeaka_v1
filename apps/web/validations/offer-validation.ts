import { z } from "zod";

export const createOfferSchema = z.object({
  listingId: z.string().min(1, "Choose a device"),
  requestId: z.string().min(1, "Choose a request"),
  message: z
    .string()
    .trim()
    .max(1000, "Keep your note under 1000 characters")
    .optional()
    .transform((v) => v || undefined),
});

export type CreateOfferInput = z.input<typeof createOfferSchema>;

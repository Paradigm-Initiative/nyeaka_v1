import { z } from "zod";

export const sharePhoneSchema = z.object({
  share: z.boolean(),
  /** Only needed the first time, when there is no number on the account yet. */
  phone: z.string().trim().max(30).optional(),
});
export type SharePhoneInput = z.input<typeof sharePhoneSchema>;

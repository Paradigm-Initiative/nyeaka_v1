import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";

export const reportSchema = z.object({
  targetType: z.enum(["USER", "LISTING", "REQUEST"]),
  targetId: z.string().min(1),
  reason: z.enum(ReportReason, { error: "chooseReason" }),
  details: z
    .string()
    .trim()
    .max(1000, "tooLong1000")
    .optional()
    .transform((v) => v || undefined),
});

export type ReportInput = z.input<typeof reportSchema>;

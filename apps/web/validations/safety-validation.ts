import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";

export const reportSchema = z.object({
  targetType: z.enum(["USER", "LISTING", "REQUEST"]),
  targetId: z.string().min(1),
  reason: z.enum(ReportReason, { error: "Choose a reason" }),
  details: z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters")
    .optional()
    .transform((v) => v || undefined),
});

export type ReportInput = z.input<typeof reportSchema>;

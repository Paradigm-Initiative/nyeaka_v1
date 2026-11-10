import type { ReportReason } from "@/generated/prisma/enums";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "SCAM", label: "Scam or fraud" },
  { value: "MISREPRESENTED_DEVICE", label: "Device not as described" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Something else" },
];

export const reasonLabel = (r: ReportReason) =>
  REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

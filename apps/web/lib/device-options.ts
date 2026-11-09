import type { Condition, DeviceType } from "@/generated/prisma/enums";

// UI label <-> Prisma enum. The UI only offers three kinds; DESKTOP/OTHER exist in the DB.
export const KIND_OPTIONS = [
  { label: "phone", value: "SMARTPHONE" },
  { label: "tablet", value: "TABLET" },
  { label: "laptop", value: "LAPTOP" },
] as const satisfies readonly { label: string; value: DeviceType }[];

export const CONDITION_OPTIONS = [
  { label: "New", value: "NEW" },
  { label: "Like new", value: "LIKE_NEW" },
  { label: "Good", value: "GOOD" },
  { label: "Fair", value: "FAIR" },
] as const satisfies readonly { label: string; value: Condition }[];

export const kindLabel = (v: DeviceType) =>
  KIND_OPTIONS.find((o) => o.value === v)?.label ?? v.toLowerCase();

export const conditionLabel = (v: Condition) =>
  CONDITION_OPTIONS.find((o) => o.value === v)?.label ?? v;

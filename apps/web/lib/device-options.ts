import type { Condition, DeviceType } from "@/generated/prisma/enums";

// The UI only offers three kinds; DESKTOP/OTHER exist in the DB.
// Labels are translated: namespace `device`, keys `kind.<VALUE>` and `condition.<VALUE>`.
export const KIND_VALUES = ["SMARTPHONE", "TABLET", "LAPTOP"] as const satisfies readonly DeviceType[];

export const CONDITION_VALUES = ["NEW", "LIKE_NEW", "GOOD", "FAIR"] as const satisfies readonly Condition[];

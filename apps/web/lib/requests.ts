import { prisma } from "@/neon-db";
import {
  createRequestSchema,
  type CreateRequestInput,
} from "@/validations/post-validation";
import { defaultExpiry } from "./expiry";

export async function createRequest(
  requesterId: string,
  input: CreateRequestInput,
) {
  const { pledge, ...d } = createRequestSchema.parse(input);
  void pledge; // validated only, not stored

  return prisma.request.create({
    data: { requesterId, ...d, expiresAt: defaultExpiry() },
    select: { id: true },
  });
}

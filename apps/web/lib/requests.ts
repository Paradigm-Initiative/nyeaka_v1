import { prisma } from "@/neon-db";
import {
  createRequestSchema,
  type CreateRequestInput,
} from "@/validations/post-validation";
import { defaultExpiry } from "./expiry";
import { assertOwner } from "./ownership";
import { assertState, postState } from "./lifecycle";

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

async function loadState(id: string) {
  const row = await prisma.request.findUniqueOrThrow({
    where: { id },
    select: { status: true, expiresAt: true },
  });
  return postState(row.status, row.expiresAt);
}

/** Owner edits a live request. expiresAt is deliberately left unchanged. */
export async function updateRequest(userId: string, id: string, input: CreateRequestInput) {
  await assertOwner("request", id, userId);
  assertState(await loadState(id), ["ACTIVE"], "Only live requests can be edited. Renew it first.");

  const { pledge, ...d } = createRequestSchema.parse(input);
  void pledge;
  return prisma.request.update({
    where: { id },
    data: { ...d, area: d.area || null, preferredBrand: d.preferredBrand || null },
    select: { id: true },
  });
}

export async function closeRequest(userId: string, id: string) {
  await assertOwner("request", id, userId);
  assertState(await loadState(id), ["ACTIVE"], "This request is not live.");
  return prisma.request.update({ where: { id }, data: { status: "CLOSED" }, select: { id: true } });
}

/** Reopen a closed or expired request for another 60 days. */
export async function renewRequest(userId: string, id: string) {
  await assertOwner("request", id, userId);
  assertState(await loadState(id), ["EXPIRED", "CLOSED"], "Only closed or expired requests can be renewed.");
  return prisma.request.update({
    where: { id },
    data: { status: "ACTIVE", expiresAt: defaultExpiry() },
    select: { id: true },
  });
}

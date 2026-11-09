import { prisma } from "@/neon-db";
import { assertOwner } from "./ownership";
import { assertState, postState } from "./lifecycle";
import {
  createListingSchema,
  type CreateListingInput,
} from "@/validations/post-validation";
import { defaultExpiry } from "./expiry";
import { ServiceError } from "./errors";
import { listingPhotoPrefix } from "./storage";

export async function createListing(donorId: string, input: CreateListingInput) {
  const d = createListingSchema.parse(input);

  const prefix = listingPhotoPrefix(donorId);
  if (d.photos.some((url) => !url.startsWith(prefix)))
    throw new ServiceError("INVALID", "Photos must be uploaded through Nyeaka");

  return prisma.listing.create({
    data: {
      donorId,
      deviceType: d.deviceType,
      title: `${d.brand} ${d.model}`,
      description:
        d.description || `${d.brand} ${d.model} in ${d.condition.toLowerCase().replace("_", " ")} condition.`,
      brand: d.brand,
      model: d.model,
      condition: d.condition,
      city: d.city,
      area: d.area || null,
      countryCode: d.countryCode,
      photos: d.photos,
      expiresAt: defaultExpiry(),
      spec:
        d.hasCharger !== undefined || d.hasKeyboard !== undefined
          ? { create: { hasCharger: d.hasCharger, hasKeyboard: d.hasKeyboard } }
          : undefined,
    },
    select: { id: true },
  });
}

function assertOwnPhotos(donorId: string, photos: string[]) {
  const prefix = listingPhotoPrefix(donorId);
  if (photos.some((url) => !url.startsWith(prefix)))
    throw new ServiceError("INVALID", "Photos must be uploaded through Nyeaka");
}

async function loadState(id: string) {
  const row = await prisma.listing.findUniqueOrThrow({
    where: { id },
    select: { status: true, expiresAt: true },
  });
  return postState(row.status, row.expiresAt);
}

/** Owner edits a live listing. expiresAt is deliberately left unchanged. */
export async function updateListing(userId: string, id: string, input: CreateListingInput) {
  await assertOwner("listing", id, userId);
  assertState(await loadState(id), ["ACTIVE"], "Only live listings can be edited. Renew it first.");

  const d = createListingSchema.parse(input);
  assertOwnPhotos(userId, d.photos);

  const spec = { hasCharger: d.hasCharger, hasKeyboard: d.hasKeyboard };
  return prisma.listing.update({
    where: { id },
    data: {
      deviceType: d.deviceType,
      title: `${d.brand} ${d.model}`,
      description:
        d.description || `${d.brand} ${d.model} in ${d.condition.toLowerCase().replace("_", " ")} condition.`,
      brand: d.brand,
      model: d.model,
      condition: d.condition,
      city: d.city,
      area: d.area || null,
      countryCode: d.countryCode,
      photos: d.photos,
      spec: { upsert: { create: spec, update: spec } },
    },
    select: { id: true },
  });
}

export async function closeListing(userId: string, id: string) {
  await assertOwner("listing", id, userId);
  assertState(await loadState(id), ["ACTIVE"], "This listing is not live.");
  return prisma.listing.update({ where: { id }, data: { status: "CLOSED" }, select: { id: true } });
}

/** Reopen a closed or expired listing for another 60 days. */
export async function renewListing(userId: string, id: string) {
  await assertOwner("listing", id, userId);
  assertState(await loadState(id), ["EXPIRED", "CLOSED"], "Only closed or expired listings can be renewed.");
  return prisma.listing.update({
    where: { id },
    data: { status: "ACTIVE", expiresAt: defaultExpiry() },
    select: { id: true },
  });
}

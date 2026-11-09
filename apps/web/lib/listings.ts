import { prisma } from "@/neon-db";
import {
  createListingSchema,
  type CreateListingInput,
} from "@/validations/post-validation";
import { defaultExpiry } from "./expiry";

export async function createListing(donorId: string, input: CreateListingInput) {
  const d = createListingSchema.parse(input);

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

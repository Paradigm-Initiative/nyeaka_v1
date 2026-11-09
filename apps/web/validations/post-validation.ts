import { z } from "zod";
import { Condition, DeviceType } from "@/generated/prisma/enums";

const city = z.string().trim().min(2, "Enter a city").max(100);
const area = z.string().trim().max(100).optional();
const countryCode = z
  .string()
  .trim()
  .length(2, "Use a 2-letter country code")
  .transform((v) => v.toUpperCase());

export const MAX_PHOTOS = 3;

export const createListingSchema = z.object({
  deviceType: z.enum(DeviceType, { error: "Choose a device type" }),
  brand: z.string().trim().min(1, "Enter the brand").max(60),
  model: z.string().trim().min(1, "Enter the model").max(80),
  condition: z.enum(Condition, { error: "Choose a condition" }),
  description: z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters")
    .optional(),
  city,
  area,
  countryCode,
  photos: z.array(z.url("Invalid photo URL")).max(MAX_PHOTOS).default([]),
  hasCharger: z.boolean().optional(),
  hasKeyboard: z.boolean().optional(),
});

export const createRequestSchema = z.object({
  deviceType: z.enum(DeviceType, { error: "Choose a device type" }),
  title: z.string().trim().min(5, "Add a short title").max(120),
  description: z
    .string()
    .trim()
    .min(10, "Tell donors a bit more about why you need it")
    .max(280, "Keep it under 280 characters"),
  preferredBrand: z.string().trim().max(60).optional(),
  isUrgent: z.boolean().default(false),
  minCondition: z.enum(Condition).optional(),
  city,
  area,
  countryCode,
  pledge: z
    .boolean()
    .refine((v) => v === true, "You must accept the pledge"),
});

export type CreateListingInput = z.input<typeof createListingSchema>;
export type CreateListingData = z.output<typeof createListingSchema>;
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type CreateRequestData = z.output<typeof createRequestSchema>;

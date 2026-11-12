import { z } from "zod";
import { Condition, DeviceType } from "@/generated/prisma/enums";

const city = z.string().trim().min(2, "enterCity").max(100);
const area = z.string().trim().max(100).optional();
const countryCode = z
  .string()
  .trim()
  .length(2, "countryCode")
  .transform((v) => v.toUpperCase());

export const MAX_PHOTOS = 3;

export const createListingSchema = z.object({
  deviceType: z.enum(DeviceType, { error: "chooseDeviceType" }),
  brand: z.string().trim().min(1, "enterBrand").max(60),
  model: z.string().trim().min(1, "enterModel").max(80),
  condition: z.enum(Condition, { error: "chooseCondition" }),
  description: z
    .string()
    .trim()
    .max(1000, "tooLong1000")
    .optional(),
  city,
  area,
  countryCode,
  photos: z.array(z.url("photoInvalid")).max(MAX_PHOTOS).default([]),
  hasCharger: z.boolean().optional(),
  hasKeyboard: z.boolean().optional(),
});

export const createRequestSchema = z.object({
  deviceType: z.enum(DeviceType, { error: "chooseDeviceType" }),
  title: z.string().trim().min(5, "addTitle").max(120),
  description: z
    .string()
    .trim()
    .min(10, "tellMore")
    .max(280, "tooLong280"),
  preferredBrand: z.string().trim().max(60).optional(),
  isUrgent: z.boolean().default(false),
  minCondition: z.enum(Condition).optional(),
  city,
  area,
  countryCode,
  pledge: z
    .boolean()
    .refine((v) => v === true, "acceptPledge"),
});

export type CreateListingInput = z.input<typeof createListingSchema>;
export type CreateListingData = z.output<typeof createListingSchema>;
export type CreateRequestInput = z.input<typeof createRequestSchema>;
export type CreateRequestData = z.output<typeof createRequestSchema>;

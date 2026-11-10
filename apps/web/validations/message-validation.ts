import { z } from "zod";

export const MESSAGE_MAX = 2000;

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(MESSAGE_MAX, `Keep messages under ${MESSAGE_MAX} characters`),
});

export type SendMessageInput = z.input<typeof sendMessageSchema>;

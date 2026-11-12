import { z } from "zod";

export const MESSAGE_MAX = 2000;

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "messageEmpty")
    .max(MESSAGE_MAX, "messageTooLong"),
});

export type SendMessageInput = z.input<typeof sendMessageSchema>;

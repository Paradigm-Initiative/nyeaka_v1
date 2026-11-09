import { SendByte } from "@sendbyte/node";
import { SendEmailParams } from "../types/types";

const sendByte = new SendByte(process.env.SENDBYTE_KEY as string);

const DEFAULT_FROM = process.env.EMAIL_FROM ?? "Nyeaka <no-reply@nyeaka.org>";

export async function sendEmail({
  from = DEFAULT_FROM,
  to,
  subject,
  html,
}: SendEmailParams) {
  const { id } = await sendByte.emails.send({ from, to, subject, html });
  return id;
}

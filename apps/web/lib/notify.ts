import { sendEmail } from "./email";

interface Mail {
  subject: string;
  html: string;
}

/**
 * Send an email without ever throwing. Call this after the database change has
 * committed: a mail failure must not undo or fail the action that triggered it.
 */
export async function sendSafely(to: string, mail: Mail, label: string): Promise<boolean> {
  try {
    await sendEmail({ to, ...mail });
    return true;
  } catch (e) {
    console.error(`${label}: email failed`, e);
    return false;
  }
}

/** Email the admin address (ADMIN_EMAIL). Skipped with a warning if it isn't set. */
export async function notifyAdmin(mail: Mail, label: string): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    console.warn(`${label}: ADMIN_EMAIL is not set, so the admin was not emailed`);
    return false;
  }
  return sendSafely(to, mail, label);
}

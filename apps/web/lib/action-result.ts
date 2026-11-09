import type { ZodError } from "zod";
import { ServiceError } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function toFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Map a thrown error to an ActionResult. Unknown errors are logged and hidden from the user. */
export function failure(e: unknown, label: string): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ServiceError) {
    const fieldErrors = e.message.startsWith("Photos") ? { photos: e.message } : undefined;
    return { ok: false, error: e.message, fieldErrors };
  }
  console.error(label, e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

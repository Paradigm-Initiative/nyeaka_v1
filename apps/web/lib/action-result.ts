import type { ZodError } from "zod";
import { ServiceError } from "./errors";
import { errorKey } from "./error-keys";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// `error` and every `fieldErrors` value are translation keys (namespaces `errors`
// and `validation`), never English. The UI translates them with useErrorText().

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
    const error = errorKey(e.message, e.code);
    const fieldErrors: Record<string, string> | undefined =
      error === "photosViaNyeaka"
        ? { photos: error }
        : error === "invalidPhone"
          ? { phone: error }
          : undefined;
    return { ok: false, error, fieldErrors };
  }
  console.error(label, e);
  return { ok: false, error: "generic" };
}

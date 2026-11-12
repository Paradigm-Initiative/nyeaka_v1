"use client";

import { useTranslations } from "next-intl";
import { knownErrorKey } from "./error-keys";

/**
 * Turns an error key from a server action (or a Zod issue code) into text in the
 * current language. Looks in `errors`, then `validation`, then falls back to a
 * generic message. English sentences that services/queries still produce are
 * mapped to their key first.
 */
export function useErrorText() {
  const errors = useTranslations("errors");
  const validation = useTranslations("validation");
  const text = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const key = knownErrorKey(raw) ?? raw;
    if (errors.has(key)) return errors(key);
    if (validation.has(key)) return validation(key);
    return errors("generic");
  };
  /** Translate every value of a fieldErrors map. */
  const fields = (fe?: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(fe ?? {}).map(([k, v]) => [k, text(v) ?? v]));
  return Object.assign(text, { fields });
}

/** Better Auth returns a machine `code` with every error; unknown codes get the generic message. */
export function useAuthErrorText() {
  const t = useTranslations("authErrors");
  const errors = useTranslations("errors");
  return (code?: string | null): string => (code && t.has(code) ? t(code) : errors("generic"));
}

import { z } from "zod";
import { DeviceType } from "@/generated/prisma/enums";

export const PAGE_SIZE = 12;

export interface BrowseFilters {
  q: string;
  type?: DeviceType;
  city?: string;
  page: number;
}

const schema = z.object({
  q: z.string().trim().max(80).catch(""),
  type: z.enum(DeviceType).optional().catch(undefined),
  city: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

type RawParams = { [key: string]: string | string[] | undefined };

export function parseBrowseParams(raw: RawParams): BrowseFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = schema.parse({
    q: first(raw.q) ?? "",
    type: first(raw.type),
    city: first(raw.city) || undefined,
    page: first(raw.page) ?? 1,
  });
  return { q: parsed.q, type: parsed.type, city: parsed.city, page: parsed.page };
}

/** Build a query string from filters, dropping defaults. */
export function browseHref(basePath: string, f: Partial<BrowseFilters>): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.type) sp.set("type", f.type);
  if (f.city) sp.set("city", f.city);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";
import { locales } from "@/i18n/config";
import { COUNTRY_CONFIG } from "@/lib/countries";
import { BY_CODE, BY_MESSAGE } from "@/lib/error-keys";

type Tree = { [k: string]: string | Tree };
const catalogues: Record<string, Tree> = { en, fr, pt };

const flat = (t: Tree, prefix = ""): Record<string, string> =>
  Object.entries(t).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...out, [key]: v } : { ...out, ...flat(v, key) };
  }, {});

const flats = Object.fromEntries(Object.entries(catalogues).map(([l, t]) => [l, flat(t)]));
const others = locales.filter((l) => l !== "en");
// ICU arguments like {who} or {count, plural, ...}: the names must match across languages.
// Only `{name}` and `{name, plural|select|...}` count: words inside a plural branch (`one {Your rating}`) don't.
const args = (s: string) =>
  [...new Set([...s.matchAll(/\{(\w+)\s*(?:,\s*(?:plural|select|selectordinal|number|date|time)\b|\})/g)].map((m) => m[1]))].sort();

describe("catalogues", () => {
  it("every supported locale has a catalogue", () => {
    expect(Object.keys(catalogues).sort()).toEqual([...locales].sort());
  });

  it.each(others)("%s has exactly the keys English has", (l) => {
    const keys = Object.keys(flats.en);
    expect(keys.filter((k) => !(k in flats[l]))).toEqual([]);
    expect(Object.keys(flats[l]).filter((k) => !(k in flats.en))).toEqual([]);
  });

  it.each(others)("%s uses the same {placeholders} as English, and no value is empty", (l) => {
    const bad = Object.keys(flats.en).filter(
      (k) => !flats[l][k]?.trim() || args(flats[l][k]).join() !== args(flats.en[k]).join(),
    );
    expect(bad).toEqual([]);
  });
});

describe("errors the UI can show", () => {
  const errors = (l: string) => (catalogues[l].errors as Tree) ?? {};
  const keys = [...new Set([...Object.values(BY_MESSAGE), ...Object.values(BY_CODE), "generic"])];

  it.each(locales)("%s has a translation for every mapped service error key", (l) => {
    expect(keys.filter((k) => typeof errors(l)[k] !== "string")).toEqual([]);
  });
});

describe("country-dependent copy", () => {
  it.each(locales)("%s has an example city for every configured country", (l) => {
    const cities = catalogues[l].cityExamples as Record<string, string>;
    expect(COUNTRY_CONFIG.filter((c) => !cities[c.code]?.trim()).map((c) => c.code)).toEqual([]);
    expect(Object.keys(cities).filter((c) => !COUNTRY_CONFIG.some((x) => x.code === c))).toEqual([]);
  });

  it("French and Portuguese use their own city names where they differ", () => {
    expect((fr.cityExamples as Record<string, string>).EG).toBe("Le Caire");
    expect((pt.cityExamples as Record<string, string>).DZ).toBe("Argel");
  });
});

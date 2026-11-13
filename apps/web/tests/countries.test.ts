import { describe, it, expect } from "vitest";
import {
  COUNTRY_CONFIG,
  countryName,
  getCountries,
  getCountryConfig,
  isKnownCountry,
} from "@/lib/countries";

describe("country config", () => {
  it("covers the 54 African countries with unique codes", () => {
    expect(COUNTRY_CONFIG).toHaveLength(54);
    expect(new Set(COUNTRY_CONFIG.map((c) => c.code)).size).toBe(54);
    for (const c of COUNTRY_CONFIG) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.idDocTypes).toContain("PASSPORT"); // accepted everywhere
      expect(c.reviewerChecklist.length).toBeGreaterThan(0);
    }
  });

  it("knows the African countries, in any case, and nothing else", () => {
    expect(isKnownCountry("NG")).toBe(true);
    expect(isKnownCountry("gh")).toBe(true);
    expect(isKnownCountry("GB")).toBe(false);
    expect(isKnownCountry("")).toBe(false);
    expect(isKnownCountry(null)).toBe(false);
  });

  it("only NG national IDs have a format check (NIN, 11 digits)", () => {
    const withRule = COUNTRY_CONFIG.filter((c) => c.idNumber).map((c) => c.code);
    expect(withRule).toEqual(["NG"]);
    const rule = getCountryConfig("NG")!.idNumber!;
    expect(rule.docType).toBe("NATIONAL_ID");
    expect(rule.pattern.test("12345678901")).toBe(true);
    expect(rule.pattern.test("1234567890")).toBe(false);
    expect(rule.pattern.test("1234567890a")).toBe(false);
  });
});

describe("country lists and names", () => {
  it("lists every configured country in the requested language, sorted for it", () => {
    const en = getCountries("en");
    expect(en).toHaveLength(54);
    expect(en.find((c) => c.code === "CI")?.name).toBe("Côte d’Ivoire");
    expect(getCountries("fr").find((c) => c.code === "EG")?.name).toBe("Égypte");
    expect(en.map((c) => c.name)).toEqual([...en.map((c) => c.name)].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("`only` limits the list to the given codes, but keeps an explicitly included one", () => {
    const only = ["NG", "GH"];
    expect(getCountries("en", { only }).map((c) => c.code).sort()).toEqual(["GH", "NG"]);
    expect(getCountries("en", { only, include: "ke" }).map((c) => c.code).sort()).toEqual(["GH", "KE", "NG"]);
    expect(getCountries("en", { only, include: null }).map((c) => c.code).sort()).toEqual(["GH", "NG"]);
    expect(getCountries("en", { only: [] })).toEqual([]);
  });

  it("names any ISO code, including legacy rows outside the config", () => {
    expect(countryName("GB", "en")).toBe("United Kingdom");
    expect(countryName("NG", "pt")).toBe("Nigéria");
  });

});

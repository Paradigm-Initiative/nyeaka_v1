import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { ServiceError } from "@/lib/errors";
import { getExampleNumber } from "libphonenumber-js/max";
import examples from "libphonenumber-js/examples.mobile.json";
import { COUNTRY_CONFIG } from "@/lib/countries";

describe("normalizePhone", () => {
  it("returns international (E.164) format, ignoring spaces and punctuation", () => {
    expect(normalizePhone(" +234 (806) 412-0088 ")).toBe("+2348064120088");
    expect(normalizePhone("+254 712 345 678")).toBe("+254712345678");
  });

  it("treats a leading 00 as +", () => {
    expect(normalizePhone("00234 806 412 0088")).toBe("+2348064120088");
  });

  it("reads a local number in the given country, whatever the country's own rules", () => {
    expect(normalizePhone("0806.412.0088", "NG")).toBe("+2348064120088");
    expect(normalizePhone("0806.412.0088", "ng")).toBe("+2348064120088");
    expect(normalizePhone("024 123 4567", "GH")).toBe("+233241234567");
    expect(normalizePhone("0712 345 678", "KE")).toBe("+254712345678");
    expect(normalizePhone("082 123 4567", "ZA")).toBe("+27821234567");
    expect(normalizePhone("77 123 4567", "SN")).toBe("+221771234567"); // no trunk 0 at all
  });

  it("keeps the 0 where the country's own numbers keep it (Côte d'Ivoire)", () => {
    expect(normalizePhone("07 12 34 56 78", "CI")).toBe("+2250712345678");
  });

  it("an international number ignores the account's country", () => {
    expect(normalizePhone("+254712345678", "NG")).toBe("+254712345678");
  });

  it("does not guess when there is no country and the number is local", () => {
    expect(() => normalizePhone("08064120088")).toThrow(ServiceError);
    expect(() => normalizePhone("08064120088", null)).toThrow(ServiceError);
    expect(() => normalizePhone("08064120088", "ZZ")).toThrow(ServiceError);
  });

  it("rejects numbers that are not real for their country, not just ones with a bad length", () => {
    for (const bad of ["", "abc", "123456", "+123456", "+2348064", "+23400000000000", "0806 412", "+23 48x064120088", "080-6412-0088-ext", "+0123456789", "1234567890123456"])
      expect(() => normalizePhone(bad, "NG")).toThrow(ServiceError);
    expect(() => normalizePhone("024 123 4567", "NG")).toThrow(ServiceError); // a Ghana number is not a Nigerian one
  });

  it("uses an error message the UI can translate", () => {
    expect(() => normalizePhone("nope")).toThrow(/valid phone number/);
  });
});

describe("every African country works with no per-country phone config", () => {
  it.each(COUNTRY_CONFIG.map((c) => c.code))("%s: a real local mobile number validates, in local and international form", (code) => {
    const example = getExampleNumber(code as never, examples);
    expect(example, `no example number for ${code}`).toBeDefined();
    expect(normalizePhone(example!.formatNational(), code)).toBe(example!.number);
    expect(normalizePhone(example!.formatInternational())).toBe(example!.number);
  });
});

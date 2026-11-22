import { describe, expect, it } from "vitest";
import { reviewerGuideUrl } from "@/lib/reviewer-guide";

describe("reviewer guide link", () => {
  it("is absent when unset or blank", () => {
    expect(reviewerGuideUrl("NG", undefined)).toBeNull();
    expect(reviewerGuideUrl("NG", "  ")).toBeNull();
  });

  it("fills in the country code, upper-cased and encoded", () => {
    expect(reviewerGuideUrl("ng", "https://docs.example.org/id/{country}")).toBe("https://docs.example.org/id/NG");
    expect(reviewerGuideUrl("NG", "https://docs.example.org/guide")).toBe("https://docs.example.org/guide");
    expect(reviewerGuideUrl("a/b", "https://docs.example.org/{country}/x")).toBe("https://docs.example.org/A%2FB/x");
  });

  it("only links to http(s) addresses", () => {
    expect(reviewerGuideUrl("NG", "javascript:alert(1)")).toBeNull();
    expect(reviewerGuideUrl("NG", "not a url")).toBeNull();
    expect(reviewerGuideUrl("NG", "http://intranet/guide")).toBe("http://intranet/guide");
  });
});

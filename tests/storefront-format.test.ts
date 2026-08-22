import { describe, expect, it } from "vitest";
import { formatDecimal, formatLitres, formatStorefrontDate } from "@/lib/format";

describe("storefront locale formatting", () => {
  it("uses Finnish decimal punctuation for Finnish copy", () => {
    expect(formatDecimal(4.9, "fi", { minimumFractionDigits: 1 })).toBe("4,9");
    expect(formatLitres(10500, "fi")).toBe("10,5");
  });

  it("uses English decimal punctuation for English copy", () => {
    expect(formatDecimal(4.9, "en", { minimumFractionDigits: 1 })).toBe("4.9");
    expect(formatLitres(10500, "en")).toBe("10.5");
  });

  it("formats storefront dates using the selected locale", () => {
    expect(formatStorefrontDate("2026-08-22", "fi")).toBe("22.8.2026");
    expect(formatStorefrontDate("2026-08-22", "en")).toBe("22 Aug 2026");
  });
});

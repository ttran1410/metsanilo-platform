import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";

describe("customer contact normalization", () => {
  it.each([
    ["+358504679703", "+358504679703"],
    ["358504679703", "+358504679703"],
    ["+358 50 4679703", "+358504679703"],
    ["0504679703", "+358504679703"],
    ["+358 50 467 9703", "+358504679703"],
    ["050 467 9703", "+358504679703"],
  ])("normalizes Finnish mobile %s", (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  it("normalizes an international E.164 number", () => {
    expect(normalizeMobile("+46 (70) 123-4567")).toBe("+46701234567");
  });

  it("trims and lowercases email without altering provider semantics", () => {
    expect(normalizeEmail("  ISMO.RINNE@EXAMPLE.FI ")).toBe("ismo.rinne@example.fi");
    expect(normalizeEmail(" ")).toBeNull();
  });
});

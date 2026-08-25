import { describe, expect, it } from "vitest";
import { calculateCapacityAdjustment } from "@/domain/availability";

describe("capacity quick adjustment", () => {
  it("adds and removes exactly the requested delta", () => {
    expect(calculateCapacityAdjustment(100_000, 30_000, 5_000)).toBe(105_000);
    expect(calculateCapacityAdjustment(100_000, 30_000, -5_000)).toBe(95_000);
  });

  it("blocks reductions below reserved volume", () => {
    expect(() => calculateCapacityAdjustment(30_000, 30_000, -5_000)).toThrow("reserved");
  });
});

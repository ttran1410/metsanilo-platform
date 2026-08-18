import { describe, expect, it } from "vitest";
import { getPageNumbers } from "@/app/admin/ui/admin-pagination";

describe("Admin Pagination Utility Logic", () => {
  it("returns simple page list when totalPages <= 7", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("handles start of page range when currentPage <= 4", () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, "...", 10]);
    expect(getPageNumbers(4, 12)).toEqual([1, 2, 3, 4, 5, "...", 12]);
  });

  it("handles middle of page range with double ellipses", () => {
    expect(getPageNumbers(5, 10)).toEqual([1, "...", 4, 5, 6, "...", 10]);
    expect(getPageNumbers(7, 15)).toEqual([1, "...", 6, 7, 8, "...", 15]);
  });

  it("handles end of page range when currentPage >= totalPages - 3", () => {
    expect(getPageNumbers(9, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
    expect(getPageNumbers(10, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });
});

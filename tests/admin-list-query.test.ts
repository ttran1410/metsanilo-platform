import { describe, expect, it } from "vitest";
import { hasListQuery, paged, parseAdminListQuery } from "@/lib/admin-list-query";

describe("admin list query contract", () => {
  it("parses bounded pagination and calculates the offset", () => {
    const query = parseAdminListQuery(new Request("http://localhost/api/admin/reviews?q=berry&page=3&pageSize=10"));
    expect(query).toMatchObject({ q: "berry", page: 3, pageSize: 10, offset: 20 });
  });

  it("uses safe defaults and detects query-driven requests", () => {
    const request = new Request("http://localhost/api/admin/users");
    expect(parseAdminListQuery(request)).toMatchObject({ q: "", page: 1, pageSize: 25, offset: 0 });
    expect(hasListQuery(request)).toBe(false);
    expect(hasListQuery(new Request("http://localhost/api/admin/users?page=2"))).toBe(true);
  });

  it("returns stable page metadata", () => {
    expect(paged(["a", "b"], 7, { q: "", page: 2, pageSize: 2, offset: 2 })).toEqual({
      items: ["a", "b"],
      total: 7,
      page: 2,
      pageSize: 2,
      totalPages: 4,
      hasNextPage: true,
    });
  });
});

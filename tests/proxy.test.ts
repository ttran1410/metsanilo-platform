import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy routing and security", () => {
  it("attaches storefront locale and correlation ID for localized paths", () => {
    const request = new NextRequest("https://example.test/fi/shop");
    const response = proxy(request);
    expect(response.headers.get("x-storefront-locale") || response.headers.get("x-middleware-request-x-storefront-locale")).toBe("fi");
    const correlation = response.headers.get("x-correlation-id") || response.headers.get("x-middleware-request-x-correlation-id");
    expect(correlation).toBeDefined();
  });

  it("returns top-level 401 JSON for unauthenticated admin API requests without basic auth challenge", async () => {
    const request = new NextRequest("https://example.test/api/admin/orders");
    const response = proxy(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(response.headers.get("x-correlation-id")).toBeDefined();
    const body = await response.json();
    expect(body).toEqual({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      correlationId: expect.any(String),
    });
  });

  it("redirects unauthenticated admin UI requests to /admin/login with safe relative next parameter", () => {
    const request = new NextRequest("https://example.test/admin/orders?filter=active");
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/admin/login?next=%2Fadmin%2Forders%3Ffilter%3Dactive");
    expect(response.headers.get("x-correlation-id")).toBeDefined();
  });

  it("allows requests with Better Auth session cookies", () => {
    const request = new NextRequest("https://example.test/admin/orders", {
      headers: {
        cookie: "better-auth.session_token=test-token",
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

});

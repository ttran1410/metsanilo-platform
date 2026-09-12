import { describe, expect, it, vi } from "vitest";
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

  it("records http_basic telemetry on unauthenticated request and extraneous_basic on authenticated request", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    // 1. Unauthenticated attempt with Basic Auth -> http_basic
    const unauthReq = new NextRequest("https://example.test/api/admin/orders", {
      headers: {
        authorization: "Basic YWRtaW46cGFzc3dvcmQ=",
        cookie: "metsanilo_session=legacy-token",
      },
    });
    const unauthRes = proxy(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Authenticated attempt with redundant Basic Auth -> extraneous_basic
    const authReq = new NextRequest("https://example.test/api/admin/orders", {
      headers: {
        authorization: "Basic YWRtaW46cGFzc3dvcmQ=",
        cookie: "better-auth.session_token=valid-token",
      },
    });
    const authRes = proxy(authReq);
    expect(authRes.status).toBe(200);

    const loggedMechanisms = info.mock.calls.map((call) => {
      try {
        return JSON.parse(String(call[1])).mechanism;
      } catch {
        return null;
      }
    });

    expect(loggedMechanisms).toContain("legacy_cookie");
    expect(loggedMechanisms).toContain("http_basic");
    expect(loggedMechanisms).toContain("extraneous_basic");
    info.mockRestore();
  });
});

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

  it("returns 401 JSON for unauthenticated admin API requests without basic auth challenge", () => {
    const request = new NextRequest("https://example.test/api/admin/orders");
    const response = proxy(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(response.headers.get("x-correlation-id")).toBeDefined();
  });

  it("redirects unauthenticated admin UI requests to /admin/login", () => {
    const request = new NextRequest("https://example.test/admin/orders");
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/admin/login");
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

  it("records legacy telemetry for legacy cookie and basic auth attempts", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const request = new NextRequest("https://example.test/api/admin/orders", {
      headers: {
        authorization: "Basic YWRtaW46cGFzc3dvcmQ=",
        cookie: "metsanilo_session=legacy-token",
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(401);
    expect(info).toHaveBeenCalled();

    const loggedMechanisms = info.mock.calls.map((call) => {
      try {
        return JSON.parse(String(call[1])).mechanism;
      } catch {
        return null;
      }
    });

    expect(loggedMechanisms).toContain("legacy_cookie");
    expect(loggedMechanisms).toContain("extraneous_basic");
    info.mockRestore();
  });
});

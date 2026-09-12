import { describe, expect, it, vi } from "vitest";
import {
  CookieJar,
  resolveSmokeTarget,
  runAuthSmokeTests,
  SmokeConfigError,
} from "../scripts/auth-readiness-smoke";

describe("auth readiness smoke runner", () => {
  describe("target URL validation", () => {
    it("rejects empty or invalid URLs", () => {
      expect(() => resolveSmokeTarget("")).toThrow(SmokeConfigError);
      expect(() => resolveSmokeTarget("not-a-url")).toThrow(SmokeConfigError);
      expect(() => resolveSmokeTarget("ftp://example.com")).toThrow(SmokeConfigError);
    });

    it("rejects embedded credentials in target URL", () => {
      expect(() => resolveSmokeTarget("https://admin:pass@example.com")).toThrow(SmokeConfigError);
    });

    it("prevents execution on production origin without explicit bypass", () => {
      expect(() => resolveSmokeTarget("https://metsanilo.vercel.app")).toThrow(
        /targets production origin/,
      );
      const allowed = resolveSmokeTarget("https://metsanilo.vercel.app", true);
      expect(allowed.origin).toBe("https://metsanilo.vercel.app");
    });

    it("allows valid local and staging URLs", () => {
      const target = resolveSmokeTarget("http://localhost:3000/");
      expect(target.origin).toBe("http://localhost:3000");
    });
  });

  describe("CookieJar", () => {
    it("tracks, updates, and deletes cookies from responses", () => {
      const jar = new CookieJar();
      const headers = new Headers();
      headers.append("set-cookie", "better-auth.session_token=token-1; Path=/; HttpOnly");
      headers.append("set-cookie", "theme=dark; Path=/");

      jar.updateFromHeaders(headers);
      expect(jar.getCookieHeader()).toContain("better-auth.session_token=token-1");
      expect(jar.getCookieHeader()).toContain("theme=dark");

      const deleteHeaders = new Headers();
      deleteHeaders.append("set-cookie", "theme=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
      jar.updateFromHeaders(deleteHeaders);

      expect(jar.getCookieHeader()).toBe("better-auth.session_token=token-1");
    });
  });

  describe("runAuthSmokeTests", () => {
    it("executes positive and negative flows against mock fetch", async () => {
      const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString();
        const url = new URL(urlStr);

        let currentSessionValid = true;

        if (url.pathname === "/api/auth/better/sign-in/email") {
          const body = JSON.parse(String(init?.body || "{}"));
          if (body.password === "ValidPassword123!") {
            currentSessionValid = true;
            const resHeaders = new Headers({
              "set-cookie": "better-auth.session_token=mock-session-token; Path=/",
              "x-correlation-id": "corr-123",
            });
            return new Response(JSON.stringify({ user: { email: body.email } }), {
              status: 200,
              headers: resHeaders,
            });
          }
          return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
        }

        if (url.pathname === "/api/auth/session") {
          const cookieHeader = (init?.headers as Record<string, string>)?.["cookie"] ?? (init?.headers as Headers)?.get?.("cookie") ?? "";
          if (!currentSessionValid || !cookieHeader || !cookieHeader.includes("better-auth.session_token")) {
            return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Authentication required" }), {
              status: 401,
              headers: { "x-correlation-id": "corr-sess-unauth" },
            });
          }
          return new Response(
            JSON.stringify({
              data: {
                user: { email: "admin@example.test", role: "ADMIN" },
              },
            }),
            {
              status: 200,
              headers: { "x-correlation-id": "corr-sess" },
            },
          );
        }

        if (url.pathname === "/api/auth/better/sign-out") {
          currentSessionValid = false;
          const resHeaders = new Headers({
            "set-cookie": "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
            "x-correlation-id": "corr-signout",
          });
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
        }

        if (url.pathname === "/api/auth/better/sign-up/email") {
          return new Response(JSON.stringify({ code: "ENDPOINT_DISABLED" }), {
            status: 404,
            headers: { "x-correlation-id": "corr-signup" },
          });
        }

        if (url.pathname === "/api/auth/login") {
          return new Response(JSON.stringify({ code: "ENDPOINT_RETIRED" }), {
            status: 410,
            headers: { "x-correlation-id": "corr-login-retired" },
          });
        }

        if (url.pathname === "/api/auth/logout") {
          const originHeader = (init?.headers as Record<string, string>)?.["origin"] ?? (init?.headers as Headers)?.get?.("origin");
          if (!originHeader || originHeader !== url.origin) {
            return new Response(JSON.stringify({ code: "FORBIDDEN" }), {
              status: 403,
              headers: { "x-correlation-id": "corr-logout-forbidden" },
            });
          }
          return new Response(JSON.stringify({ code: "ENDPOINT_RETIRED" }), {
            status: 410,
            headers: { "x-correlation-id": "corr-logout-retired" },
          });
        }

        return new Response("Not Found", { status: 404 });
      });

      const outcome = await runAuthSmokeTests({
        baseUrl: "http://localhost:3000",
        adminEmail: "admin@example.test",
        adminPassword: "ValidPassword123!",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.errors).toEqual([]);
      expect(outcome.results.length).toBeGreaterThanOrEqual(4);
    });
  });
});

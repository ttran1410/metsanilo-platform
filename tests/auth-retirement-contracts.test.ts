import { describe, expect, it } from "vitest";
import { GET as loginGet, POST as loginPost, PUT as loginPut, PATCH as loginPatch, DELETE as loginDelete, OPTIONS as loginOptions, HEAD as loginHead } from "@/app/api/auth/login/route";
import { GET as logoutGet, POST as logoutPost, PUT as logoutPut, PATCH as logoutPatch, DELETE as logoutDelete, OPTIONS as logoutOptions, HEAD as logoutHead } from "@/app/api/auth/logout/route";
import { HEAD as betterHead } from "@/app/api/auth/better/[...all]/route";

describe("Retirement endpoint contracts (/api/auth/login, /api/auth/logout)", () => {
  it("login endpoint returns top-level 410 with correlation header, no-store, and cookie purge for POST and other methods", async () => {
    const correlationId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const postReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        cookie: "metsanilo_session=stale-token",
      },
      body: JSON.stringify({ email: "admin@example.test", password: "password" }),
    });

    const postRes = await loginPost(postReq);
    expect(postRes.status).toBe(410);
    expect(postRes.headers.get("x-correlation-id")).toBe(correlationId);
    expect(postRes.headers.get("cache-control")).toBe("no-store, max-age=0");
    const setCookies = postRes.headers.getSetCookie?.() ?? [postRes.headers.get("set-cookie") ?? ""];
    const joinedCookies = setCookies.join(" ");
    expect(joinedCookies).toContain("metsanilo_session=");
    expect(joinedCookies).toContain("better-auth.session_token=");
    
    const body = await postRes.json();
    expect(body).toEqual({
      code: "ENDPOINT_RETIRED",
      message: "Legacy login endpoint is decommissioned. Use Better Auth.",
      correlationId,
    });

    // Check HEAD returns empty body and headers
    const headReq = new Request("http://localhost:3000/api/auth/login", {
      method: "HEAD",
      headers: { "x-correlation-id": correlationId },
    });
    const headRes = await loginHead(headReq);
    expect(headRes.status).toBe(410);
    expect(headRes.headers.get("x-correlation-id")).toBe(correlationId);
    expect(headRes.headers.get("cache-control")).toBe("no-store, max-age=0");
    const headText = await headRes.text();
    expect(headText).toBe("");

    // Check unsupported methods return 405 with top-level format
    const getRes = await loginGet(new Request("http://localhost:3000/api/auth/login", { method: "GET" }));
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("allow")).toBe("POST, OPTIONS, HEAD");
    expect(await getRes.json()).toMatchObject({
      code: "METHOD_NOT_ALLOWED",
      correlationId: expect.any(String),
    });

    const putRes = await loginPut(new Request("http://localhost:3000/api/auth/login", { method: "PUT" }));
    expect(putRes.status).toBe(405);
    const patchRes = await loginPatch(new Request("http://localhost:3000/api/auth/login", { method: "PATCH" }));
    expect(patchRes.status).toBe(405);
    const deleteRes = await loginDelete(new Request("http://localhost:3000/api/auth/login", { method: "DELETE" }));
    expect(deleteRes.status).toBe(405);
    const optionsRes = await loginOptions(new Request("http://localhost:3000/api/auth/login", { method: "OPTIONS", headers: { "x-correlation-id": correlationId } }));
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("allow")).toBe("POST, OPTIONS, HEAD");
    expect(optionsRes.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(optionsRes.headers.get("x-correlation-id")).toBe(correlationId);
  });

  it("logout endpoint validates same-origin and purges all legacy/auth cookies", async () => {
    // 1. Missing / cross-origin POST is rejected with 403
    const crossOriginReq = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://evil-attacker.test",
        cookie: "metsanilo_session=stale-token",
      },
    });
    const crossRes = await logoutPost(crossOriginReq);
    expect(crossRes.status).toBe(403);
    const crossBody = await crossRes.json();
    expect(crossBody).toMatchObject({
      code: "FORBIDDEN",
      message: "Same-origin request required",
      correlationId: expect.any(String),
    });

    // 2. Same-origin POST returns 410 with top-level format and cookie purges
    const sameOriginReq = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: "metsanilo_session=stale-token",
      },
    });
    const sameRes = await logoutPost(sameOriginReq);
    expect(sameRes.status).toBe(410);
    expect(sameRes.headers.get("cache-control")).toBe("no-store, max-age=0");
    const setCookies = sameRes.headers.getSetCookie?.() ?? [sameRes.headers.get("set-cookie") ?? ""];
    const joinedCookies = setCookies.join(" ");
    expect(joinedCookies).toContain("metsanilo_session=");
    expect(joinedCookies).toContain("better-auth.session_token=");

    const sameBody = await sameRes.json();
    expect(sameBody).toEqual({
      code: "ENDPOINT_RETIRED",
      message: "Legacy logout endpoint is decommissioned. Use Better Auth.",
      correlationId: expect.any(String),
    });

    // 3. HEAD on logout
    const headRes = await logoutHead(new Request("http://localhost:3000/api/auth/logout", { method: "HEAD" }));
    expect(headRes.status).toBe(410);
    expect(await headRes.text()).toBe("");

    // 4. Other methods return 405
    const getRes = await logoutGet(new Request("http://localhost:3000/api/auth/logout", { method: "GET" }));
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("allow")).toBe("POST, OPTIONS, HEAD");
    const putRes = await logoutPut(new Request("http://localhost:3000/api/auth/logout", { method: "PUT" }));
    expect(putRes.status).toBe(405);
    const patchRes = await logoutPatch(new Request("http://localhost:3000/api/auth/logout", { method: "PATCH" }));
    expect(patchRes.status).toBe(405);
    const deleteRes = await logoutDelete(new Request("http://localhost:3000/api/auth/logout", { method: "DELETE" }));
    expect(deleteRes.status).toBe(405);
    const optionsRes = await logoutOptions(new Request("http://localhost:3000/api/auth/logout", { method: "OPTIONS", headers: { "x-correlation-id": "corr-opt-logout" } }));
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("allow")).toBe("POST, OPTIONS, HEAD");
    expect(optionsRes.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(optionsRes.headers.get("x-correlation-id")).toBe("corr-opt-logout");
  });
});

describe("Better Auth wrapper multi-cookie & HEAD preservation", () => {
  it("preserves multiple Set-Cookie headers, body stream, and correlation ID without data corruption", async () => {
    const rawResponse = new Response("ok", {
      headers: {
        "set-cookie": "cookie1=val1; Path=/",
      },
    });
    // Add second cookie
    const headers = new Headers(rawResponse.headers);
    headers.append("set-cookie", "cookie2=val2; Path=/");
    const multiCookieResponse = new Response("ok", { headers });

    const { withCorrelationHeader } = await import("@/lib/better-auth-wrapper");
    const wrapped = withCorrelationHeader(
      multiCookieResponse,
      "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
    );

    expect(wrapped.headers.get("x-correlation-id")).toBe("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    const setCookies = wrapped.headers.getSetCookie?.() ?? [wrapped.headers.get("set-cookie") ?? ""];
    expect(setCookies.length).toBeGreaterThanOrEqual(2);
  });

  it("handles HEAD requests and disabled endpoints cleanly", async () => {
    const headReq = new Request("http://localhost:3000/api/auth/better/change-password", { method: "HEAD" });
    const headRes = await betterHead(headReq);
    expect(headRes.status).toBe(404);
    expect(headRes.headers.get("x-correlation-id")).toBeDefined();
    expect(await headRes.text()).toBe("");
  });
});

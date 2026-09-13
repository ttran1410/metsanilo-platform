import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

describe("removed legacy auth endpoints", () => {
  it.each([
    ["login", login, "/api/auth/login"],
    ["logout", logout, "/api/auth/logout"],
  ])("returns an API 404 for %s", async (_name, handler, path) => {
    const response = await handler(new Request(`https://example.test${path}`, { method: "POST" }));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND", correlationId: expect.any(String) });
  });
});

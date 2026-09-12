import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { failure, methodNotAllowed, success } from "@/app/api/response";

describe("admin API response contract", () => {
  it("returns data, correlation id, and matching header in the success envelope", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "x-correlation-id": "11111111-2222-4333-8444-555555555555" },
    });
    const response = success({ ok: true }, request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-correlation-id")).toBe("11111111-2222-4333-8444-555555555555");
    expect(await response.json()).toEqual({
      data: { ok: true },
      correlationId: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("mints a fresh correlation id if header is missing or malformed", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "x-correlation-id": "invalid-uuid" },
    });
    const response = success({ ok: true }, request);
    const correlationHeader = response.headers.get("x-correlation-id");
    expect(correlationHeader).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const body = await response.json();
    expect(body.correlationId).toBe(correlationHeader);
  });

  it("returns safe domain errors with a matching correlation header and body", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: { "x-correlation-id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
    });
    const response = failure(new DomainError("FORBIDDEN", "Permission required", 403), request);
    expect(response.status).toBe(403);
    expect(response.headers.get("x-correlation-id")).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(await response.json()).toMatchObject({
      code: "FORBIDDEN",
      message: "Permission required",
      correlationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
  });

  it("does not expose unexpected error details", async () => {
    const request = new Request("http://localhost/api/test");
    const response = failure(new Error("database password leaked"), request);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.message).toBe("An unexpected server error occurred while processing your request. Please try again or contact support.");
    expect(body.message).not.toContain("database password");
    expect(response.headers.get("x-correlation-id")).toBe(body.correlationId);
  });

  it("returns 405 Method Not Allowed with Allow and correlation headers", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "GET",
      headers: { "x-correlation-id": "cccccccc-dddd-4eee-8fff-000000000000" },
    });
    const response = methodNotAllowed(["POST"], request);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("x-correlation-id")).toBe("cccccccc-dddd-4eee-8fff-000000000000");
    expect(await response.json()).toEqual({
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed. Supported method: POST.",
      correlationId: "cccccccc-dddd-4eee-8fff-000000000000",
    });
  });

  it("returns 405 with empty body for HEAD requests", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "HEAD",
      headers: { "x-correlation-id": "dddddddd-eeee-4fff-8000-111111111111" },
    });
    const response = methodNotAllowed(["POST"], request);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("x-correlation-id")).toBe("dddddddd-eeee-4fff-8000-111111111111");
    expect(await response.text()).toBe("");
  });
});

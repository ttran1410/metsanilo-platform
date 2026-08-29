import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { failure, success } from "@/app/api/response";

describe("admin API response contract", () => {
  it("returns data and correlation id in the success envelope", async () => {
    const response = success({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ data: { ok: true }, correlationId: expect.any(String) });
  });

  it("returns safe domain errors with a correlation id", async () => {
    const response = failure(new DomainError("FORBIDDEN", "Permission required", 403));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN", message: "Permission required", correlationId: expect.any(String) });
  });

  it("does not expose unexpected error details", async () => {
    const response = failure(new Error("database password leaked"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.message).toBe("An unexpected server error occurred while processing your request. Please try again or contact support.");
    expect(body.message).not.toContain("database password");
  });
});

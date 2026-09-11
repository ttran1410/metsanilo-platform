import { describe, expect, it, vi } from "vitest";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";

describe("legacy authentication telemetry", () => {
  it("records only the approved low-cardinality fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    process.env.VERCEL_GIT_COMMIT_SHA = "release-test";
    recordLegacyAuthUsage(new Request("https://example.test/api/auth/login?email=private@example.test", {
      headers: { authorization: "Basic sensitive", cookie: "metsanilo_session=sensitive", "x-correlation-id": "correlation-test" },
    }), "login_endpoint", 401);

    const payload = JSON.parse(String(info.mock.calls[0]?.[1]));
    expect(payload).toEqual(expect.objectContaining({ route: "/api/auth/login", mechanism: "login_endpoint", statusClass: "4xx", releaseSha: "release-test", correlationId: "correlation-test" }));
    expect(JSON.stringify(payload)).not.toContain("private@example.test");
    expect(JSON.stringify(payload)).not.toContain("sensitive");
    expect(Object.keys(payload).sort()).toEqual(["correlationId", "mechanism", "releaseSha", "route", "statusClass", "timestamp"].sort());
    info.mockRestore();
  });
});

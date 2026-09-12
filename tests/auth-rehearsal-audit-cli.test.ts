import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runAuthCutoverRehearsal } from "../scripts/rehearse-auth-cutover";
import { resolveAuditTarget } from "../scripts/audit-auth-readiness";

describe("CLI Safety and Target Resolution", () => {
  it("resolveAuditTarget defaults to local file:local.db without mutating production", () => {
    const target = resolveAuditTarget([], {});
    expect(target.target).toBe("local");
    expect(target.databaseUrl).toBe("file:local.db");
    expect(target.shopId).toBe("shop-main");
  });

  it("resolveAuditTarget fails closed when --target=production is specified without remote url", () => {
    expect(() =>
      resolveAuditTarget(["--target=production"], { TURSO_DATABASE_URL: "file:local.db" })
    ).toThrow(/Target is set to production but TURSO_DATABASE_URL is missing or local file URL/);

    expect(() =>
      resolveAuditTarget(["--target=production"], {})
    ).toThrow(/Target is set to production but TURSO_DATABASE_URL is missing/);
  });

  it("resolveAuditTarget respects --shop-id and --url arguments", () => {
    const target = resolveAuditTarget(["--url=file:custom.db", "--shop-id=shop-north"], {});
    expect(target.target).toBe("explicit");
    expect(target.databaseUrl).toBe("file:custom.db");
    expect(target.shopId).toBe("shop-north");
  });
});

describe("Standalone Rehearsal Execution", () => {
  it("runs standalone rehearsal in temporary database and cleans up properly", async () => {
    const result = await runAuthCutoverRehearsal({
      shopId: "shop-rehearsal",
      adminEmail: "rehearsal-admin@example.test",
    });

    expect(result.ok).toBe(true);
    expect(result.auditResult.ok).toBe(true);
    expect(result.auditResult.findings).toEqual([]);
    expect(result.auditResult.adminCount).toBeGreaterThanOrEqual(1);
    expect(result.auditResult.managerCount).toBeGreaterThanOrEqual(1);

    // Verify temp database actually exists on disk prior to cleanup
    expect(existsSync(result.databasePath)).toBe(true);

    // Call cleanup and ensure safe idempotency
    result.cleanup();
    expect(existsSync(result.databasePath)).toBe(false);

    result.cleanup();
    expect(existsSync(result.databasePath)).toBe(false);
  });
});

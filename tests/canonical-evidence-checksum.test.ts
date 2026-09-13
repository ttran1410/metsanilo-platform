import { describe, expect, it } from "vitest";
import { calculateManifestSha256 } from "../scripts/capture-source-manifest";
import { isValidShopCutoverMarker, type CutoverAuditPayload } from "../scripts/cutover-auth";

describe("Canonical Evidence & Checksum Tests", () => {
  it("calculates deterministic SHA-256 hash independent of object property insertion order", () => {
    const baseManifest = {
      manifestVersion: 2 as const,
      capturedAt: "2026-09-13T03:00:00.000Z",
      databaseName: "metsanilo-prod",
      databaseHostname: "metsanilo-prod.turso.io",
      migration: {
        id: 41,
        hash: "some-hash",
        createdAt: 1789221020745,
        repoTag: "0041_noisy_legion",
      },
      counts: {
        users: 10,
        authUsers: 10,
        authAccounts: 10,
        authSessions: 5,
        auditEntries: 100,
      },
    };

    const hash1 = calculateManifestSha256(baseManifest);

    // Reconstruct with mixed property orders
    const permutedManifest = {
      counts: {
        auditEntries: 100,
        authSessions: 5,
        authAccounts: 10,
        authUsers: 10,
        users: 10,
      },
      databaseHostname: "metsanilo-prod.turso.io",
      capturedAt: "2026-09-13T03:00:00.000Z",
      manifestVersion: 2 as const,
      databaseName: "metsanilo-prod",
      migration: {
        repoTag: "0041_noisy_legion",
        createdAt: 1789221020745,
        hash: "some-hash",
        id: 41,
      },
    };

    const hash2 = calculateManifestSha256(permutedManifest);
    expect(hash1).toBe(hash2);
  });

  it("validates valid and invalid shop cutover markers", () => {
    const validMarker = {
      id: "audit:cutover:shop-main",
      shopId: "shop-main",
      action: "auth.cutover_executed",
      detailsJson: JSON.stringify({
        runId: "12345678-1234-4234-8234-123456789abc",
        releaseSha: "abcdef1234567890abcdef1234567890abcdef12",
        target: "production",
        shopId: "shop-main",
        totalSessionsDeletedCount: 5,
        updatedUsersCount: 10,
        correlationId: "87654321-4321-4321-8321-cba987654321",
        committedAt: "2026-09-13T03:00:00.000Z",
      } satisfies CutoverAuditPayload),
    };

    expect(isValidShopCutoverMarker(validMarker, "shop-main")).toBe(true);

    // Mismatched shop ID
    expect(isValidShopCutoverMarker(validMarker, "shop-other")).toBe(false);

    // Wrong action
    expect(isValidShopCutoverMarker({ ...validMarker, action: "auth.something_else" }, "shop-main")).toBe(false);

    // Malformed details
    expect(isValidShopCutoverMarker({ ...validMarker, detailsJson: "not-json" }, "shop-main")).toBe(false);
  });
});

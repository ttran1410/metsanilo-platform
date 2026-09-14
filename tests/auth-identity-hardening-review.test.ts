import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase, type Database } from "@/db/client";
import { auditEntries, authUsers, shops, userPermissions } from "@/db/schema";
import { createUser, executeAdminUserCommand, updateUserPermission, updateUserProfileAndRole } from "@/domain/admin-user-actions";

const SHOP_ID = "shop-main";
const migrationsFolder = join(process.cwd(), "drizzle");
const testDirectories: string[] = [];

describe("Identity & Access Review Hardening Tests", () => {
  let database: Database;

  beforeEach(async () => {
    const directory = mkdtempSync(join(tmpdir(), "metsanilo-identity-review-"));
    testDirectories.push(directory);
    database = createDatabase(`file:${join(directory, "test.db")}`);
    await migrate(database, { migrationsFolder });
    await database.insert(shops).values({
      id: SHOP_ID,
      slug: "main",
      nameFi: "Pääkauppa",
      nameEn: "Main",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Nouto",
      pickupNameEn: "Pickup",
      pickupAddress: "Test",
      pickupInstructionsFi: "Test",
      pickupInstructionsEn: "Test",
      pickupTime: "20:00",
    });
  });

  afterAll(() => {
    for (const directory of testDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("createUser fails with CONFLICT 409 when authUsers already has the email", async () => {
    const email = `conflict-auth-${Date.now()}@example.com`;
    // Insert into authUsers directly
    await database.insert(authUsers).values({
      id: `auth-${Date.now()}`,
      name: "Existing Auth User",
      email,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    await expect(
      createUser(database, adminContext, {
        email,
        displayName: "New User",
        role: "STAFF",
        password: "ValidPassword123!",
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "CONFLICT", status: 409 }));
  });

  it("updateUserProfileAndRole updates role and displayName atomically in a single transaction", async () => {
    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    const user = await createUser(database, adminContext, {
      email: `atomic-user-${Date.now()}@example.com`,
      displayName: "Initial Name",
      role: "STAFF",
      password: "ValidPassword123!",
    });

    // Execute combined update
    const updated = await executeAdminUserCommand(database, adminContext, {
      action: "update",
      userId: user.id,
      displayName: "Updated Name",
      role: "MANAGER",
    });

    if (!("displayName" in updated)) throw new Error("Expected user object");
    expect(updated.displayName).toBe("Updated Name");
    expect(updated.role).toBe("MANAGER");

    // Verify authUsers record was updated
    const authRecord = await database.query.authUsers.findFirst({ where: eq(authUsers.id, user.id) });
    expect(authRecord?.name).toBe("Updated Name");

    // Verify audit entries are present
    const audits = await database
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.shopId, SHOP_ID), eq(auditEntries.entityId, user.id)));

    expect(audits.some((a) => a.action === "user.profile_updated")).toBe(true);
    expect(audits.some((a) => a.action === "user.role_updated")).toBe(true);
  });

  it("updateUserPermission performs Idempotent No-Op when requested permission already matches effective/explicit grant", async () => {
    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    const user = await createUser(database, adminContext, {
      email: `noop-perm-${Date.now()}@example.com`,
      displayName: "Staff NoOp",
      role: "STAFF",
      password: "ValidPassword123!",
    });

    // Count audits before no-op
    const auditsBefore = await database
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.shopId, SHOP_ID), eq(auditEntries.entityId, user.id)));

    // orders.read is a default granted permission for STAFF
    const result = await updateUserPermission(database, adminContext, {
      userId: user.id,
      permission: "orders.read",
      granted: true,
    });

    expect(result).toEqual({ userId: user.id, permission: "orders.read", granted: true });

    // Audits count should not increase
    const auditsAfter = await database
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.shopId, SHOP_ID), eq(auditEntries.entityId, user.id)));

    expect(auditsAfter.length).toBe(auditsBefore.length);
  });

  it("updateUserProfileAndRole does NOT reset custom permissions when updating role", async () => {
    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    const user = await createUser(database, adminContext, {
      email: `custom-perm-role-${Date.now()}@example.com`,
      displayName: "Custom Perm User",
      role: "STAFF",
      password: "ValidPassword123!",
    });

    // Grant custom permission not in STAFF defaults
    await updateUserPermission(database, adminContext, {
      userId: user.id,
      permission: "catalog.product.delete",
      granted: true,
    });

    // Verify custom permission exists
    let grant = await database.query.userPermissions.findFirst({
      where: and(
        eq(userPermissions.userId, user.id),
        eq(userPermissions.shopId, SHOP_ID),
        eq(userPermissions.permission, "catalog.product.delete")
      ),
    });
    expect(grant?.granted).toBe(true);

    // Update role from STAFF to MANAGER
    await updateUserProfileAndRole(database, adminContext, {
      userId: user.id,
      role: "MANAGER",
    });

    // Custom grant must still exist and be true
    grant = await database.query.userPermissions.findFirst({
      where: and(
        eq(userPermissions.userId, user.id),
        eq(userPermissions.shopId, SHOP_ID),
        eq(userPermissions.permission, "catalog.product.delete")
      ),
    });
    expect(grant?.granted).toBe(true);
  });

  it("createUser validates displayName, role, and password strictly in domain", async () => {
    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    // Short / whitespace display name
    await expect(
      createUser(database, adminContext, {
        email: `valid-${Date.now()}@example.com`,
        displayName: " ",
        role: "STAFF",
        password: "ValidPassword123!",
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR", status: 422 }));

    // Invalid role
    await expect(
      createUser(database, adminContext, {
        email: `valid-${Date.now()}@example.com`,
        displayName: "Valid Name",
        role: "SUPERUSER" as unknown as "STAFF",
        password: "ValidPassword123!",
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR", status: 422 }));

    // Weak password
    await expect(
      createUser(database, adminContext, {
        email: `valid-${Date.now()}@example.com`,
        displayName: "Valid Name",
        role: "STAFF",
        password: "short",
      })
    ).rejects.toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR", status: 422 }));
  });

  it("getUserAuditTrail enforces target hierarchy (Manager cannot inspect Admin audit trail)", async () => {
    const adminContext = {
      actor: { id: "admin-1", role: "ADMIN" as const, shopId: SHOP_ID, displayName: "Admin" },
      shop: { id: SHOP_ID },
    };

    const adminUser = await createUser(database, adminContext, {
      email: `target-admin-${Date.now()}@example.com`,
      displayName: "Target Admin",
      role: "ADMIN",
      password: "ValidPassword123!",
    });

    const managerContext = {
      actor: { id: "manager-1", role: "MANAGER" as const, shopId: SHOP_ID, displayName: "Manager" },
      shop: { id: SHOP_ID },
    };

    const { getUserAuditTrail } = await import("@/domain/admin-user-actions");

    await expect(
      getUserAuditTrail(database, managerContext, adminUser.id)
    ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN", status: 403 }));
  });
});

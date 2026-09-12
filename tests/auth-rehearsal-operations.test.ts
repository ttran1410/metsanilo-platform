import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import {
  changeOwnPassword,
  assertCanManageUserSessions,
  assertOperationalAccess,
  toggleUserActive,
  currentUser,
} from "@/domain/access";
import { resetAdminUserPassword } from "@/domain/admin-user-actions";
import { provisionUserWithAuth, touchBetterAuthSession } from "@/lib/auth-integration";
import { createBetterAuthInstance, resetBetterAuthForTests } from "@/lib/better-auth";
import { POST as changePasswordRoute } from "@/app/api/auth/change-password/route";

describe("Operational Flows and Domain Actions Rehearsal", () => {
  let tempDir: string;
  let database: Database;
  let closeDatabase: () => void;
  let auth: ReturnType<typeof createBetterAuthInstance>;

  beforeEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), "metsanilo-rehearsal-ops-"));
    process.env.TURSO_DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    process.env.SHOP_ID = "shop-main";
    process.env.BETTER_AUTH_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.BETTER_AUTH_URL = "http://localhost:3000/api/auth/better";
    resetEnvForTests();
    resetBetterAuthForTests();

    const conn = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
    database = conn.database;
    closeDatabase = conn.close;

    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    await database.insert(shops).values({
      id: "shop-main",
      slug: "main",
      nameFi: "Main",
      nameEn: "Main",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Pickup",
      pickupNameEn: "Pickup",
      pickupAddress: "Test",
      pickupInstructionsFi: "Test",
      pickupInstructionsEn: "Test",
      pickupTime: "20:00",
    });

    auth = createBetterAuthInstance({ database });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetBetterAuthForTests();
    resetEnvForTests();
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function seedUser(
    id: string,
    email: string,
    role: "ADMIN" | "MANAGER" | "STAFF",
    password = "Password123!",
    mustChangePassword = false
  ) {
    const hash = hashPassword(password);
    const now = new Date("2026-09-12T12:00:00.000Z");
    const issuedAt = mustChangePassword ? now.toISOString() : null;
    const expiresAt = mustChangePassword ? new Date(now.getTime() + 86400000).toISOString() : null;

    await database.insert(users).values({
      id,
      shopId: "shop-main",
      email,
      username: email,
      displayName: email,
      passwordHash: hash,
      role,
      active: true,
      mustChangePassword,
      temporaryPasswordIssuedAt: issuedAt,
      temporaryPasswordExpiresAt: expiresAt,
      sessionVersion: 1,
      createdAt: now.toISOString(),
    });
    await database.insert(authUsers).values({
      id,
      name: email,
      email,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(authAccounts).values({
      id: `credential-${id}`,
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function signIn(email: string, password: string) {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/better/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email, password, rememberMe: false }),
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0] ?? "";
    return { response, cookie };
  }

  it("rehearses full HTTP sign-in, forced-change block on operational action, route password change, and cookie purge", async () => {
    await seedUser("temp-user-1", "temp@example.test", "STAFF", "TemporaryPass123!", true);

    // 1. Sign in via Better Auth HTTP route
    const { response: signInRes, cookie } = await signIn("temp@example.test", "TemporaryPass123!");
    expect(signInRes.status).toBe(200);
    expect(cookie).toContain("better-auth.session_token=");

    // 2. Validate current user from session
    const actor = await currentUser(database, new Request("http://localhost:3000/api/admin/orders", { headers: { cookie } }));
    expect(actor.id).toBe("temp-user-1");
    expect(actor.mustChangePassword).toBe(true);

    // 3. Operational access block
    expect(() => assertOperationalAccess(actor)).toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        status: 403,
      })
    );

    // 4. Change password via HTTP route handler
    const changeReq = new Request("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        currentPassword: "TemporaryPass123!",
        newPassword: "BrandNewSecurePassword123!",
      }),
    });

    const changeRes = await changePasswordRoute(changeReq);
    expect(changeRes.status).toBe(200);
    const changeBody = await changeRes.json();
    expect(changeBody.data).toEqual({ changed: true, requireSignIn: true });

    // Verify session was revoked in database
    const sessions = await database.query.authSessions.findMany({
      where: eq(authSessions.userId, "temp-user-1"),
    });
    expect(sessions.length).toBe(0);

    // 5. Old cookie is now rejected
    await expect(
      currentUser(database, new Request("http://localhost:3000/api/admin/orders", { headers: { cookie } }))
    ).rejects.toThrow();

    // 6. Sign in with old password fails
    const oldSignIn = await signIn("temp@example.test", "TemporaryPass123!");
    expect(oldSignIn.response.status).not.toBe(200);

    // 7. Sign in with new password succeeds and has operational access
    const newSignIn = await signIn("temp@example.test", "BrandNewSecurePassword123!");
    expect(newSignIn.response.status).toBe(200);
    const newActor = await currentUser(database, new Request("http://localhost:3000/api/admin/orders", { headers: { cookie: newSignIn.cookie } }));
    expect(newActor.mustChangePassword).toBe(false);
    expect(() => assertOperationalAccess(newActor)).not.toThrow();
  });

  it("rehearses user suspension invalidating active sessions", async () => {
    await seedUser("admin-op", "admin-op@example.test", "ADMIN", "AdminPass123!");
    await seedUser("staff-suspend", "staff-suspend@example.test", "STAFF", "StaffPass123!");

    const adminSignIn = await signIn("admin-op@example.test", "AdminPass123!");
    await signIn("staff-suspend@example.test", "StaffPass123!");

    // Suspend staff user
    await toggleUserActive(
      database,
      new Request("http://localhost:3000/api/admin/users/staff-suspend/active", {
        method: "PUT",
        headers: { cookie: adminSignIn.cookie },
      }),
      { userId: "staff-suspend", active: false }
    );

    // Verify staff sessions deleted
    const staffSessions = await database.query.authSessions.findMany({
      where: eq(authSessions.userId, "staff-suspend"),
    });
    expect(staffSessions.length).toBe(0);

    // Staff sign-in rejected
    const failedSignIn = await signIn("staff-suspend@example.test", "StaffPass123!");
    expect(failedSignIn.response.status).not.toBe(200);
  });

  it("rehearses session touch with throttle and activity update", async () => {
    await seedUser("touch-user-1", "touch@example.test", "STAFF", "Password123!", false);

    const t0 = new Date("2026-09-12T12:00:00.000Z");
    const expiresAt = new Date("2026-09-19T12:00:00.000Z");

    await database.insert(authSessions).values({
      id: "sess-touch-1",
      userId: "touch-user-1",
      token: "tok-touch-1",
      expiresAt,
      createdAt: t0,
      updatedAt: t0,
      lastActivityAt: null,
    });

    // Touch past throttle window (+65s from t0 creation time) -> should update lastActivityAt
    const t1 = new Date(t0.getTime() + 65_000);
    const result1 = await touchBetterAuthSession(database, "sess-touch-1", "touch-user-1", t1);
    expect(result1.valid).toBe(true);
    if (result1.valid) {
      expect(new Date(result1.session.lastActivityAt!).getTime()).toBe(t1.getTime());
    }

    // Touch within throttle window (+30s after t1) -> should not update DB lastActivityAt
    const t2 = new Date(t1.getTime() + 30_000);
    const result2 = await touchBetterAuthSession(database, "sess-touch-1", "touch-user-1", t2);
    expect(result2.valid).toBe(true);
    if (result2.valid) {
      expect(new Date(result2.session.lastActivityAt!).getTime()).toBe(t1.getTime());
    }

    // Touch past throttle window (+65s after t1) -> should update lastActivityAt
    const t3 = new Date(t1.getTime() + 65_000);
    const result3 = await touchBetterAuthSession(database, "sess-touch-1", "touch-user-1", t3);
    expect(result3.valid).toBe(true);
    if (result3.valid) {
      expect(new Date(result3.session.lastActivityAt!).getTime()).toBe(t3.getTime());
    }
  });

  it("rehearses role hierarchy: Manager cannot revoke Admin session, Admin can revoke Manager session", async () => {
    await seedUser("admin-hier", "admin-hier@example.test", "ADMIN");
    await seedUser("manager-hier", "manager-hier@example.test", "MANAGER");

    const now = new Date();
    await database.insert(authSessions).values([
      {
        id: "admin-sess-1",
        userId: "admin-hier",
        token: "tok-admin-1",
        expiresAt: new Date(now.getTime() + 3600000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "manager-sess-1",
        userId: "manager-hier",
        token: "tok-manager-1",
        expiresAt: new Date(now.getTime() + 3600000),
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Manager attempting to manage Admin session must throw 403
    expect(() =>
      assertCanManageUserSessions(
        { id: "manager-hier", role: "MANAGER" },
        { id: "admin-hier", role: "ADMIN" }
      )
    ).toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        status: 403,
      })
    );

    // Admin resetting manager password
    const resetResult = await resetAdminUserPassword(
      database,
      {
        actor: { id: "admin-hier", role: "ADMIN", shopId: "shop-main", email: "admin-hier@example.test" },
        shop: { id: "shop-main" },
      },
      "manager-hier",
      now
    );

    expect(resetResult.temporaryPassword).toBeDefined();
    const updatedManager = (await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "manager-hier"),
    }))!;
    expect(updatedManager.mustChangePassword).toBe(true);

    // Manager sessions must be revoked
    const managerSessions = await database.query.authSessions.findMany({
      where: (s, { eq }) => eq(s.userId, "manager-hier"),
    });
    expect(managerSessions.length).toBe(0);
  });

  it("rehearses complete multi-table transaction rollback atomicity across users, auth_users, auth_accounts, permissions, sessions, and audit entries", async () => {
    // 1. Provision rollback across all affected tables
    const preUsers = await database.query.users.findMany();
    const preAuthUsers = await database.query.authUsers.findMany();
    const preAccounts = await database.query.authAccounts.findMany();
    const prePermissions = await database.query.userPermissions.findMany();
    const preAudit = await database.query.auditEntries.findMany();

    const provisionInput = {
      id: "prov-fail-1",
      shopId: "shop-main",
      email: "provfail@example.test",
      displayName: "Prov Fail",
      role: "STAFF" as const,
      passwordHash: hashPassword("Pass123!"),
    };

    await expect(
      provisionUserWithAuth(database, provisionInput, new Date(), {
        beforeCredentialInsert: () => {
          throw new Error("Fault injection: SIMULATED_PROVISION_FAILURE");
        },
      })
    ).rejects.toThrow("Fault injection: SIMULATED_PROVISION_FAILURE");

    expect(await database.query.users.findMany()).toHaveLength(preUsers.length);
    expect(await database.query.authUsers.findMany()).toHaveLength(preAuthUsers.length);
    expect(await database.query.authAccounts.findMany()).toHaveLength(preAccounts.length);
    expect(await database.query.userPermissions.findMany()).toHaveLength(prePermissions.length);
    expect(await database.query.auditEntries.findMany()).toHaveLength(preAudit.length);

    // 2. resetAdminUserPassword rollback
    await seedUser("user-reset-fail", "resetfail@example.test", "STAFF", "InitialPass123!");
    const initialUser = (await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "user-reset-fail"),
    }))!;
    const initialAccount = (await database.query.authAccounts.findFirst({
      where: (a, { eq }) => eq(a.userId, "user-reset-fail"),
    }))!;

    await expect(
      resetAdminUserPassword(
        database,
        {
          actor: { id: "admin-actor", role: "ADMIN", shopId: "shop-main", email: "admin@example.test" },
          shop: { id: "shop-main" },
        },
        "user-reset-fail",
        new Date(),
        {
          setCredentialHash: async () => {
            throw new Error("Fault injection: SIMULATED_RESET_FAILURE");
          },
        }
      )
    ).rejects.toThrow("Fault injection: SIMULATED_RESET_FAILURE");

    const postResetUser = (await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "user-reset-fail"),
    }))!;
    const postResetAccount = (await database.query.authAccounts.findFirst({
      where: (a, { eq }) => eq(a.userId, "user-reset-fail"),
    }))!;
    expect(postResetUser.passwordHash).toBe(initialUser.passwordHash);
    expect(postResetUser.mustChangePassword).toBe(false);
    expect(postResetUser.sessionVersion).toBe(initialUser.sessionVersion);
    expect(postResetAccount.password).toBe(initialAccount.password);

    // 3. changeOwnPassword rollback
    await expect(
      changeOwnPassword(
        database,
        {
          actor: { id: "user-reset-fail", role: "STAFF", shopId: "shop-main", email: "resetfail@example.test" },
          shop: { id: "shop-main" },
        },
        { currentPassword: "InitialPass123!", newPassword: "NewSecretPass123!" },
        new Date(),
        {
          setCredentialHash: async () => {
            throw new Error("Fault injection: SIMULATED_CHANGE_FAILURE");
          },
        }
      )
    ).rejects.toThrow("Fault injection: SIMULATED_CHANGE_FAILURE");

    const postChangeUser = (await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "user-reset-fail"),
    }))!;
    const postChangeAccount = (await database.query.authAccounts.findFirst({
      where: (a, { eq }) => eq(a.userId, "user-reset-fail"),
    }))!;
    expect(postChangeUser.passwordHash).toBe(initialUser.passwordHash);
    expect(postChangeUser.sessionVersion).toBe(initialUser.sessionVersion);
    expect(postChangeAccount.password).toBe(initialAccount.password);
  });
});

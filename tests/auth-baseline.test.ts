import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, resetDatabaseForTests, type Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { createUser, currentUser } from "@/domain/access";
import { hashPassword } from "@/domain/passwords";
import { createBetterAuthInstance, resetBetterAuthForTests } from "@/lib/better-auth";
import { reconcileBootstrapAdmin } from "@/lib/auth-integration";
import { resetEnvForTests } from "@/lib/env";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { GET as betterAuthGet, POST as betterAuthPost } from "@/app/api/auth/better/[...all]/route";
import { POST as legacyLogin } from "@/app/api/auth/login/route";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-auth-test-"));
let database: Database;
let closeDatabase: () => void;
let auth: ReturnType<typeof createBetterAuthInstance>;
let sequence = 0;

beforeEach(async () => {
  sequence += 1;
  process.env.TURSO_DATABASE_URL = `file:${join(directory, `auth-${sequence}.db`)}`;
  process.env.SHOP_ID = "shop-main";
  process.env.BETTER_AUTH_URL = "http://localhost:3000/api/auth/better";
  process.env.BETTER_AUTH_SECRET = "test-only-better-auth-secret-at-least-32-characters";
  resetEnvForTests();
  resetDatabaseForTests();
  resetBetterAuthForTests();
  const connection = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values([
    { id: "shop-main", slug: "main", nameFi: "Pääkauppa", nameEn: "Main", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Test", pickupInstructionsFi: "Test", pickupInstructionsEn: "Test", pickupTime: "20:00" },
    { id: "shop-other", slug: "other", nameFi: "Muu", nameEn: "Other", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Test", pickupInstructionsFi: "Test", pickupInstructionsEn: "Test", pickupTime: "20:00" },
  ]);
  auth = createBetterAuthInstance({ database });
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));
afterEach(() => {
  resetDatabaseForTests();
  resetBetterAuthForTests();
  closeDatabase();
});

async function provision(id: string, shopId = "shop-main", active = true) {
  const email = `${id}@example.test`;
  const now = new Date();
  const password = "Password123!";
  const passwordHash = hashPassword(password);
  await database.insert(users).values({ id, shopId, username: email, email, passwordHash, mustChangePassword: false, sessionVersion: 1, displayName: id, role: "ADMIN", active, createdAt: now.toISOString() });
  await database.insert(authUsers).values({ id, name: id, email, emailVerified: false, createdAt: now, updatedAt: now });
  await database.insert(authAccounts).values({ id: `credential-${id}`, accountId: id, providerId: "credential", userId: id, password: passwordHash, createdAt: now, updatedAt: now });
  return { email, password };
}

async function signIn(email: string, password: string, instance = auth) {
  const response = await instance.handler(new Request("http://localhost:3000/api/auth/better/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password, rememberMe: false }),
  }));
  return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

describe("Better Auth baseline", () => {
  it("rejects an incorrect password without issuing a session", async () => {
    const credentials = await provision("wrong-password");
    const result = await signIn(credentials.email, "WrongPassword123!");
    expect(result.response.status).toBe(401);
    expect(result.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("signs in, maps the session to the active configured-shop user, and signs out", async () => {
    const credentials = await provision("admin-main");
    const signedIn = await signIn(credentials.email, credentials.password);
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.cookie).toContain("better-auth.session_token=");

    const request = new Request("http://localhost:3000/api/admin/orders", { headers: { cookie: signedIn.cookie } });
    await expect(currentUser(database, request)).resolves.toMatchObject({ id: "admin-main", shopId: "shop-main", active: true });

    const signedOut = await auth.handler(new Request("http://localhost:3000/api/auth/better/sign-out", { method: "POST", headers: { cookie: signedIn.cookie, origin: "http://localhost:3000" } }));
    expect(signedOut.status).toBe(200);
    await expect(currentUser(database, request)).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it.each([
    ["inactive membership", "shop-main", false],
    ["cross-shop membership", "shop-other", true],
  ])("fails closed at session issuance for %s", async (_label, shopId, active) => {
    const credentials = await provision(`blocked-${sequence}`, shopId, active);
    const signedIn = await signIn(credentials.email, credentials.password);
    expect(signedIn.response.status).toBe(401);
    expect(signedIn.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("fails closed when the Better Auth identity has no shop membership", async () => {
    const credentials = await provision("missing-membership");
    await database.delete(users).where(eq(users.id, "missing-membership"));
    const signedIn = await signIn(credentials.email, credentials.password);
    expect(signedIn.response.status).toBe(401);
    expect(signedIn.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("fails closed when the mapped user has no Better Auth credential account", async () => {
    const credentials = await provision("missing-credential");
    const signedIn = await signIn(credentials.email, credentials.password);
    await database.delete(authAccounts).where(eq(authAccounts.userId, "missing-credential"));
    await expect(currentUser(database, new Request("http://localhost:3000/admin", { headers: { cookie: signedIn.cookie } }))).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects a tampered Better Auth cookie", async () => {
    await expect(currentUser(database, new Request("http://localhost:3000/admin", {
      headers: { cookie: "better-auth.session_token=tampered" },
    }))).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("proves a supported session.create database hook can block session issuance", async () => {
    const credentials = await provision("temporary-expired");
    const policyHook = vi.fn(async (userId: string) => userId !== "temporary-expired");
    const guarded = createBetterAuthInstance({ database, policyHooks: { beforeSessionCreate: policyHook } });
    const result = await signIn(credentials.email, credentials.password, guarded);

    expect(result.response.ok).toBe(false);
    expect(result.cookie).toBe("");
    expect(policyHook).toHaveBeenCalledWith("temporary-expired");
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("blocks session issuance when temporary credential has expired using injected now provider", async () => {
    const credentials = await provision("temp-expired-user");
    const issued = "2026-09-12T12:00:00.000Z";
    const expires = "2026-09-13T12:00:00.000Z";
    await database
      .update(users)
      .set({
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issued,
        temporaryPasswordExpiresAt: expires,
      })
      .where(eq(users.id, "temp-expired-user"));

    // At or after expiry: session creation must be rejected
    const expiredAuth = createBetterAuthInstance({
      database,
      now: () => new Date("2026-09-13T12:00:00.000Z"),
    });
    const resultExpired = await signIn(credentials.email, credentials.password, expiredAuth);
    expect(resultExpired.response.status).toBe(401);
    expect(resultExpired.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);

    // Before expiry: restricted session creation must succeed
    const activeAuth = createBetterAuthInstance({
      database,
      now: () => new Date("2026-09-12T18:00:00.000Z"),
    });
    const resultActive = await signIn(credentials.email, credentials.password, activeAuth);
    expect(resultActive.response.status).toBe(200);
    expect(resultActive.cookie).toContain("better-auth.session_token=");
    expect(await database.select().from(authSessions)).toHaveLength(1);
  });

  it("rejects Better Auth sign-in on preview deployments", async () => {
    process.env.VERCEL_ENV = "preview";
    try {
      const { POST } = await import("@/app/api/auth/better/[...all]/route");
      const response = await POST(new Request("https://preview.example.vercel.app/api/auth/better/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://preview.example.vercel.app" },
        body: JSON.stringify({ email: "admin@example.test", password: "Password123!" }),
      }));
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "PREVIEW_AUTH_DISABLED" });
    } finally {
      delete process.env.VERCEL_ENV;
    }
  });

  it("keeps an Admin email immutable at the API boundary", async () => {
    const credentials = await provision("immutable-email");
    const signedIn = await signIn(credentials.email, credentials.password);
    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const response = await PATCH(new Request("http://localhost:3000/api/admin/users/immutable-email", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: signedIn.cookie },
      body: JSON.stringify({ action: "update", email: "changed@example.test" }),
    }), { params: Promise.resolve({ id: "immutable-email" }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(await database.query.users.findFirst({ where: eq(users.id, "immutable-email") })).toMatchObject({ email: credentials.email });
  });

  it("provisions the application and Better Auth identities atomically", async () => {
    const credentials = await provision("provisioning-admin");
    const admin = (await signIn(credentials.email, credentials.password)).cookie;
    const created = await createUser(database, new Request("http://localhost/manager", { headers: { cookie: admin } }), { email: "provisioned@example.test", password: "Password123!", displayName: "Provisioned", role: "STAFF" });
    expect(created.email).toBe("provisioned@example.test");
    expect(await database.query.authUsers.findFirst({ where: eq(authUsers.id, created.id) })).toMatchObject({ email: created.email, emailVerified: false });
    expect(await database.query.authAccounts.findFirst({ where: eq(authAccounts.userId, created.id) })).toMatchObject({ providerId: "credential", password: created.passwordHash });
  });

  it("rolls back user provisioning when the Better Auth identity conflicts", async () => {
    const credentials = await provision("rollback-admin");
    const admin = (await signIn(credentials.email, credentials.password)).cookie;
    const now = new Date();
    await database.insert(authUsers).values({ id: "existing-auth-user", name: "Existing", email: "conflict@example.test", emailVerified: false, createdAt: now, updatedAt: now });
    await expect(createUser(database, new Request("http://localhost/manager", { headers: { cookie: admin } }), { email: "conflict@example.test", password: "Password123!", displayName: "Conflict", role: "STAFF" })).rejects.toThrow();
    expect(await database.query.users.findFirst({ where: eq(users.email, "conflict@example.test") })).toBeUndefined();
  });

  it("fails closed without issuing session when database query throws in beforeSessionCreate hook", async () => {
    const credentials = await provision("hook-fail-user");
    // Mock database query failure specifically in hook user lookup while preserving drizzle adapter methods
    const faultyDb = Object.create(database);
    faultyDb.query = {
      ...database.query,
      users: {
        ...database.query.users,
        findFirst: vi.fn(async () => {
          throw new Error("Simulated database query outage");
        }),
      },
    };

    const faultyAuth = createBetterAuthInstance({ database: faultyDb });
    const result = await signIn(credentials.email, credentials.password, faultyAuth);
    expect(result.response.status).toBe(401);
    expect(result.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);
  });

  it("preserves active Better Auth session when reconcileBootstrapAdmin is rerun", async () => {
    const bootstrapInput = {
      id: "bootstrap-admin-session-test",
      shopId: "shop-main",
      email: "bootstrap-active@example.test",
      displayName: "Bootstrap Admin",
      passwordHash: hashPassword("Password123!"),
      now: new Date("2026-09-12T12:00:00.000Z"),
    };

    // Initial seed
    await reconcileBootstrapAdmin(database, bootstrapInput);

    // Sign in to establish an active Better Auth session
    const signedIn = await signIn(bootstrapInput.email, "Password123!");
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.cookie).toContain("better-auth.session_token=");
    expect(await database.select().from(authSessions)).toHaveLength(1);

    const request = new Request("http://localhost:3000/api/admin/orders", {
      headers: { cookie: signedIn.cookie },
    });
    await expect(currentUser(database, request)).resolves.toMatchObject({
      id: bootstrapInput.id,
      shopId: "shop-main",
      active: true,
    });

    // Rerun reconcileBootstrapAdmin (e.g. during redeploy or seed command)
    await reconcileBootstrapAdmin(database, {
      ...bootstrapInput,
      displayName: "Bootstrap Admin (Updated Profile)",
    });

    // Verify session remains intact and active in database
    expect(await database.select().from(authSessions)).toHaveLength(1);
    // Verify currentUser request still resolves successfully with existing session cookie
    await expect(currentUser(database, request)).resolves.toMatchObject({
      id: bootstrapInput.id,
      displayName: "Bootstrap Admin (Updated Profile)",
      active: true,
    });
  });

  it("completes full password change lifecycle: revokes Better Auth sessions, clears cookie, rejects old password, and authenticates with new password", async () => {
    const credentials = await provision("temp-lifecycle-user");
    const issued = "2026-09-12T12:00:00.000Z";
    const expires = "2026-09-13T12:00:00.000Z";
    await database
      .update(users)
      .set({
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issued,
        temporaryPasswordExpiresAt: expires,
      })
      .where(eq(users.id, "temp-lifecycle-user"));

    // 1. Sign in with temporary credential -> succeeds with restricted session
    const signedIn = await signIn(credentials.email, credentials.password);
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.cookie).toContain("better-auth.session_token=");
    expect(await database.select().from(authSessions)).toHaveLength(1);

    // 2. Perform password change using current session cookie
    const changeReq = new Request("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: signedIn.cookie,
      },
      body: JSON.stringify({
        currentPassword: credentials.password,
        newPassword: "BrandNewSecurePassword123!",
      }),
    });

    const changeRes = await changePassword(changeReq);
    expect(changeRes.status).toBe(200);
    const body = await changeRes.json();
    expect(body).toMatchObject({ data: { changed: true, requireSignIn: true } });

    // Verify Set-Cookie clears session cookie (max-age=0)
    const setCookie = changeRes.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/Max-Age=0/i);

    // 3. Verify in database: mustChangePassword cleared, temporary timestamps null, sessionVersion incremented
    const updatedUser = await database.query.users.findFirst({
      where: eq(users.id, "temp-lifecycle-user"),
    });
    expect(updatedUser?.mustChangePassword).toBe(false);
    expect(updatedUser?.temporaryPasswordIssuedAt).toBeNull();
    expect(updatedUser?.temporaryPasswordExpiresAt).toBeNull();
    expect(updatedUser?.sessionVersion).toBe(2);

    // Verify audit entries captured both password change and session revocation
    const audits = await database.select().from(auditEntries).where(eq(auditEntries.entityId, "temp-lifecycle-user"));
    expect(audits.map((a) => a.action)).toContain("user.password_changed");
    expect(audits.map((a) => a.action)).toContain("user.sessions_revoked");

    // 4. Verify Better Auth sessions revoked in database
    expect(await database.select().from(authSessions)).toHaveLength(0);

    // 5. Subsequent request with old session cookie is rejected (UNAUTHORIZED)
    const subsequentReq = new Request("http://localhost:3000/api/admin/orders", {
      headers: { cookie: signedIn.cookie },
    });
    await expect(currentUser(database, subsequentReq)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });

    // 6. Signing in with old password fails (401)
    const oldSignIn = await signIn(credentials.email, credentials.password);
    expect(oldSignIn.response.status).toBe(401);
    expect(oldSignIn.cookie).toBe("");
    expect(await database.select().from(authSessions)).toHaveLength(0);

    // 7. Signing in with new password succeeds (200) and issues active session
    const newSignIn = await signIn(credentials.email, "BrandNewSecurePassword123!");
    expect(newSignIn.response.status).toBe(200);
    expect(newSignIn.cookie).toContain("better-auth.session_token=");
    expect(await database.select().from(authSessions)).toHaveLength(1);

    // Operational request with new cookie succeeds
    const newReq = new Request("http://localhost:3000/api/admin/orders", {
      headers: { cookie: newSignIn.cookie },
    });
    await expect(currentUser(database, newReq)).resolves.toMatchObject({
      id: "temp-lifecycle-user",
      mustChangePassword: false,
      active: true,
    });
  });

  it("blocks built-in Better Auth password change and reset endpoints from bypassing domain lifecycle", async () => {
    const blockedPaths = [
      "http://localhost:3000/api/auth/better/change-password",
      "http://localhost:3000/api/auth/better/set-password",
      "http://localhost:3000/api/auth/better/reset-password",
      "http://localhost:3000/api/auth/better/reset-password/example-token",
      "http://localhost:3000/api/auth/better/request-password-reset",
    ];

    for (const url of blockedPaths) {
      const postRes = await betterAuthPost(
        new Request(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ currentPassword: "Old", newPassword: "New" }),
        })
      );
      expect(postRes.status).toBe(404);
      const postBody = await postRes.json();
      expect(postBody).toMatchObject({
        code: "ENDPOINT_DISABLED",
        message: expect.stringContaining("canonical"),
      });

      const getRes = await betterAuthGet(new Request(url, { method: "GET" }));
      expect(getRes.status).toBe(404);
      const getBody = await getRes.json();
      expect(getBody).toMatchObject({
        code: "ENDPOINT_DISABLED",
      });
    }
  });

  it("emits user.temporary_password_expired audit event when expired temporary credential attempts session creation", async () => {
    const credentials = await provision("expired-temp-user", "shop-main", true);
    const issued = "2026-09-10T12:00:00.000Z";
    const expires = "2026-09-11T12:00:00.000Z"; // expired yesterday

    await database
      .update(users)
      .set({
        mustChangePassword: true,
        temporaryPasswordIssuedAt: issued,
        temporaryPasswordExpiresAt: expires,
      })
      .where(eq(users.id, "expired-temp-user"));

    // Attempt sign-in with expired temporary credential
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/better/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      })
    );

    // Better Auth rejects session creation (401 / no session token)
    expect(response.status).toBe(401);
    expect(await database.select().from(authSessions)).toHaveLength(0);

    // Verify user.temporary_password_expired audit entry was created
    const audits = await database
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.entityId, "expired-temp-user"));
    expect(audits.map((a) => a.action)).toContain("user.temporary_password_expired");
    const expiryAudit = audits.find((a) => a.action === "user.temporary_password_expired");
    expect(expiryAudit?.detailsJson).toContain(expires);

    // Repeated attempts for the same issuance must not create audit noise.
    const secondResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/better/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      })
    );
    expect(secondResponse.status).toBe(401);
    const repeatedAudits = await database.select().from(auditEntries).where(eq(auditEntries.entityId, "expired-temp-user"));
    expect(repeatedAudits.filter((entry) => entry.action === "user.temporary_password_expired")).toHaveLength(1);

    const legacyResponse = await legacyLogin(new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    }));
    expect(legacyResponse.status).toBe(401);
    expect(await legacyResponse.json()).toMatchObject({ code: "UNAUTHORIZED", message: "Invalid email or password" });
  });
});

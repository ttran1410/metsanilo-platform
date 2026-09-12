import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { createUser, currentUser } from "@/domain/access";
import { hashPassword } from "@/domain/passwords";
import { createBetterAuthInstance } from "@/lib/better-auth";
import { resetEnvForTests } from "@/lib/env";

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
afterEach(() => closeDatabase());

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
  ])("fails closed for %s", async (_label, shopId, active) => {
    const credentials = await provision(`blocked-${sequence}`, shopId, active);
    const signedIn = await signIn(credentials.email, credentials.password);
    expect(signedIn.response.status).toBe(200);
    await expect(currentUser(database, new Request("http://localhost:3000/admin", { headers: { cookie: signedIn.cookie } }))).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("fails closed when the Better Auth identity has no shop membership", async () => {
    const credentials = await provision("missing-membership");
    const signedIn = await signIn(credentials.email, credentials.password);
    await database.delete(users).where(eq(users.id, "missing-membership"));
    await expect(currentUser(database, new Request("http://localhost:3000/admin", { headers: { cookie: signedIn.cookie } }))).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
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
});

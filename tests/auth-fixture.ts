import { randomUUID } from "node:crypto";
import type { Database } from "@/db/client";
import { authAccounts, authUsers, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { createBetterAuthInstance } from "@/lib/better-auth";
import { BETTER_AUTH_BASE_PATH } from "@/lib/auth-config";
import type { Role } from "@/lib/permissions";

export async function provisionAuthenticatedTestUser(database: Database, input: { shopId: string; email: string; password: string; role: Role; id?: string }) {
  const id = input.id ?? randomUUID();
  const now = new Date();
  const passwordHash = hashPassword(input.password);
  await database.insert(users).values({ id, shopId: input.shopId, username: input.email, email: input.email, passwordHash, mustChangePassword: false, sessionVersion: 1, displayName: input.email, role: input.role, active: true, createdAt: now.toISOString() });
  await database.insert(authUsers).values({ id, name: input.email, email: input.email, emailVerified: false, createdAt: now, updatedAt: now });
  await database.insert(authAccounts).values({ id: `credential-${id}`, accountId: id, providerId: "credential", userId: id, password: passwordHash, createdAt: now, updatedAt: now });
  return authenticatedTestRequest(database, input.email, input.password);
}

export async function authenticatedTestRequest(database: Database, email: string, password: string, url = "http://localhost/manager") {
  const auth = createBetterAuthInstance({ database });
  const baseUrl = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000");
  const signInUrl = new URL(`${BETTER_AUTH_BASE_PATH}/sign-in/email`, baseUrl.origin);
  const response = await auth.handler(new Request(signInUrl, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password, rememberMe: false }),
  }));
  if (!response.ok) throw new Error(`Test authentication failed with ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Test authentication did not issue a session cookie");
  return new Request(url, { headers: { cookie } });
}

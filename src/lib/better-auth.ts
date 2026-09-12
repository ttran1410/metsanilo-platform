import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { createDatabase, type Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, authVerifications, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/domain/passwords";
import { env } from "./env";
import { isCredentialStateValid, isTemporaryCredentialActive } from "./auth-integration";

function configuredAuthUrl() {
  const value = process.env.BETTER_AUTH_URL?.trim();
  if (!value) return undefined;
  try { return new URL(value); } catch { return undefined; }
}

type AuthPolicyHooks = Readonly<{
  beforeSessionCreate?: (userId: string) => Promise<boolean>;
}>;

export type CreateBetterAuthOptions = {
  database?: Database;
  policyHooks?: AuthPolicyHooks;
  now?: () => Date;
};

/**
 * Parallel Better Auth instance. It is intentionally exposed under a separate
 * endpoint until shop-user synchronization and RBAC mapping are verified.
 */
export function createBetterAuthInstance(options?: CreateBetterAuthOptions) {
  const authUrl = configuredAuthUrl();
  const vercelEnvironment = process.env.VERCEL_ENV;
  const isProduction = vercelEnvironment === "production" || (!vercelEnvironment && process.env.NODE_ENV === "production");
  const trustedOrigins = ["https://metsanilo.vercel.app"];
  if (!isProduction && vercelEnvironment !== "preview" && authUrl) trustedOrigins.push(authUrl.origin);

  const database = options?.database ?? createDatabase(process.env.TURSO_DATABASE_URL || "file:local.db", process.env.TURSO_AUTH_TOKEN);
  const nowProvider = options?.now ?? (() => new Date());

  return betterAuth({
    // Keep this parallel adapter independent from the legacy runtime preflight;
    // the Better Auth endpoint validates its own secret and database settings.
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    // Better Auth requires a syntactically valid base URL even while Next is
    // collecting dynamic routes. Runtime preflight still rejects an invalid
    // production BETTER_AUTH_URL; this fallback only keeps module evaluation
    // safe for local/build environments.
    baseURL: authUrl?.toString() ?? "http://localhost:3000",
    trustedOrigins,
    secret: process.env.BETTER_AUTH_SECRET || "local-development-better-auth-secret-change-me",
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: async (password: string) => hashPassword(password),
        verify: async ({ hash, password }: { hash: string; password: string }) => verifyPassword(password, hash),
      },
    },
    session: {
      expiresIn: 60 * 60 * 8,
      // Do not roll the eight-hour absolute lifetime forward. Idle timeout is
      // enforced separately from deliberate activity in the application layer.
      updateAge: 0,
      disableSessionRefresh: true,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session: { userId: string }) => {
            try {
              const currentShopId = env().SHOP_ID;
              const user = await database.query.users.findFirst({
                where: and(eq(users.id, session.userId), eq(users.shopId, currentShopId), eq(users.active, true)),
              });
              if (!user) return false;
              if (!isCredentialStateValid(user)) return false;
              if (user.mustChangePassword && !isTemporaryCredentialActive(user, nowProvider())) {
                try {
                  await database.insert(auditEntries).values({
                    id: randomUUID(),
                    shopId: currentShopId,
                    actor: user.email ?? user.id,
                    action: "user.temporary_password_expired",
                    entityType: "user",
                    entityId: user.id,
                    detailsJson: JSON.stringify({
                      expiresAt: user.temporaryPasswordExpiresAt,
                      attemptedAt: nowProvider().toISOString(),
                    }),
                    createdAt: nowProvider().toISOString(),
                  });
                } catch {
                  // Fail closed regardless of audit insert outcome
                }
                return false;
              }
            } catch {
              return false; // Fail closed on database error
            }

            if (options?.policyHooks?.beforeSessionCreate) {
              try {
                const customResult = await options.policyHooks.beforeSessionCreate(session.userId);
                if (!customResult) return false;
              } catch {
                return false;
              }
            }
            return true;
          },
        },
      },
    },
  });
}

let cached: { configKey: string; instance: ReturnType<typeof createBetterAuthInstance> } | undefined;

export function getBetterAuthInstance() {
  const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
  const configKey = JSON.stringify([databaseUrl, process.env.BETTER_AUTH_URL, process.env.BETTER_AUTH_SECRET]);
  if (!cached || cached.configKey !== configKey) cached = { configKey, instance: createBetterAuthInstance() };
  return cached.instance;
}

export function resetBetterAuthForTests() {
  cached = undefined;
}

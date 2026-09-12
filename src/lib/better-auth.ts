import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDatabase, type Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/domain/passwords";

function configuredAuthUrl() {
  const value = process.env.BETTER_AUTH_URL?.trim();
  if (!value) return undefined;
  try { return new URL(value); } catch { return undefined; }
}

type AuthPolicyHooks = Readonly<{
  beforeSessionCreate?: (userId: string) => Promise<boolean>;
}>;

/**
 * Parallel Better Auth instance. It is intentionally exposed under a separate
 * endpoint until shop-user synchronization and RBAC mapping are verified.
 */
export function createBetterAuthInstance(options?: { database?: Database; policyHooks?: AuthPolicyHooks }) {
  const authUrl = configuredAuthUrl();
  return betterAuth({
  // Keep this parallel adapter independent from the legacy runtime preflight;
  // the Better Auth endpoint validates its own secret and database settings.
  database: drizzleAdapter(options?.database ?? createDatabase(process.env.TURSO_DATABASE_URL || "file:local.db", process.env.TURSO_AUTH_TOKEN), {
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
  trustedOrigins: [
    "https://metsanilo.vercel.app",
    ...(authUrl ? [authUrl.origin] : []),
  ],
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
    updateAge: 60 * 60,
  },
  ...(options?.policyHooks?.beforeSessionCreate
    ? {
        databaseHooks: {
          session: {
            create: {
              before: async (session: { userId: string }) => options.policyHooks!.beforeSessionCreate!(session.userId),
            },
          },
        },
      }
    : {}),
  });
}

let cached: { configKey: string; instance: ReturnType<typeof createBetterAuthInstance> } | undefined;

export function getBetterAuthInstance() {
  const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
  const configKey = JSON.stringify([databaseUrl, process.env.BETTER_AUTH_URL, process.env.BETTER_AUTH_SECRET]);
  if (!cached || cached.configKey !== configKey) cached = { configKey, instance: createBetterAuthInstance() };
  return cached.instance;
}

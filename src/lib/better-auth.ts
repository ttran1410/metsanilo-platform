import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDatabase } from "@/db/client";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/domain/passwords";

/**
 * Parallel Better Auth instance. It is intentionally exposed under a separate
 * endpoint until shop-user synchronization and RBAC mapping are verified.
 */
export const betterAuthInstance = betterAuth({
  // Keep this parallel adapter independent from the legacy runtime preflight;
  // the Better Auth endpoint validates its own secret and database settings.
  database: drizzleAdapter(createDatabase(process.env.TURSO_DATABASE_URL || "file:local.db", process.env.TURSO_AUTH_TOKEN), {
    provider: "sqlite",
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
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
});

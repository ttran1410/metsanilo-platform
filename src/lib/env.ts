import { z } from "zod";

const envSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default("file:local.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),
  SHOP_ID: z.string().min(2).max(80).default("shop-main"),
  SHOP_SLUG: z.string().min(2).max(80).default("metsanilo"),
  SHOP_NAME_FI: z.string().min(1).optional(),
  SHOP_NAME_EN: z.string().min(1).optional(),
  SHOP_TIMEZONE: z.string().min(1).default("Europe/Helsinki"),
  MANAGER_USERNAME: z.string().min(1).default("manager"),
  MANAGER_PASSWORD: z.string().min(16).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  cached ??= envSchema.parse(process.env);
  return cached;
}

export function validateRuntimeEnvironment(options?: { production?: boolean }) {
  const production = options?.production ?? process.env.NODE_ENV === "production";
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.issues.map((issue) => issue.path.join(".") || "environment") };
  }

  const config = parsed.data;
  const errors: string[] = [];
  if (production) {
    if (config.TURSO_DATABASE_URL.startsWith("file:")) errors.push("TURSO_DATABASE_URL must be a remote Turso URL");
    if (!config.TURSO_AUTH_TOKEN) errors.push("TURSO_AUTH_TOKEN is required");
    if (!config.MANAGER_PASSWORD || config.MANAGER_PASSWORD.length < 16) errors.push("MANAGER_PASSWORD must be at least 16 characters");
    if (config.MANAGER_PASSWORD === "manager" || config.MANAGER_PASSWORD === "password") errors.push("MANAGER_PASSWORD must not use a default value");
  }
  if (!config.SHOP_ID || !config.SHOP_SLUG) errors.push("SHOP_ID and SHOP_SLUG are required");
  return errors.length ? { ok: false as const, errors } : { ok: true as const, config };
}

export function resetEnvForTests() {
  cached = undefined;
}

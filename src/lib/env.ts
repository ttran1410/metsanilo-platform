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
  PRIVACY_NOTICE_URL: z.url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function env(): AppEnv {
  cached ??= envSchema.parse(process.env);
  return cached;
}

export function resetEnvForTests() {
  cached = undefined;
}

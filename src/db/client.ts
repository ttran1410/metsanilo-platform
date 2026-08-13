import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

export function createDatabaseConnection(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return { database: drizzle(client, { schema }), close: () => client.close() };
}

export function createDatabase(url: string, authToken?: string) {
  return createDatabaseConnection(url, authToken).database;
}

export type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

export function db() {
  const config = env();
  database ??= createDatabase(config.TURSO_DATABASE_URL, config.TURSO_AUTH_TOKEN);
  return database;
}

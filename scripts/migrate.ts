import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
client.close();
console.log(`Migrations applied to ${url.startsWith("file:") ? url : "configured Turso database"}.`);

import { and, eq, like, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { customers } from "@/db/schema";
import { env } from "@/lib/env";

export async function searchCustomers(database: Database, query: string) {
  const value = query.trim();
  if (value.length < 2) return [];
  return database.select().from(customers).where(and(eq(customers.shopId, env().SHOP_ID), or(like(customers.mobile, `%${value}%`), like(customers.email, `%${value.toLowerCase()}%`), like(customers.name, `%${value}%`)))).limit(25);
}

export async function listCustomers(database: Database) {
  return database.select().from(customers).where(eq(customers.shopId, env().SHOP_ID)).limit(100);
}

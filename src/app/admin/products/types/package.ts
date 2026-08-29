import type { packages } from "@/db/schema";

export type AdminProductPackage = typeof packages.$inferSelect;

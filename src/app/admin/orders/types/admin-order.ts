import type { orders } from "@/db/schema";

export type AdminOrder = typeof orders.$inferSelect & {
  paidCents?: number;
  outstandingCents?: number | null;
  paymentStatus?: string;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

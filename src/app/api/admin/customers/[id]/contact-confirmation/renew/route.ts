import { renewAdminCustomerContact } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../../../../response";
import { executeAdmin } from "../../../../module";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async () => id, run: async (customerId, { database, context: { actor } }) => renewAdminCustomerContact(database, { actor, shop: { id: env().SHOP_ID } }, customerId) }); return success(result); } catch (error) { return failure(error, request); }
}

import { db } from "@/db/client";
import { renewAdminCustomerContact } from "@/domain/admin-customer-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../../../../response";
import { authenticateAdmin } from "../../../../module";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = (await authenticateAdmin(request, "customers.retention.manage")).actor; const { id } = await context.params; return success(await renewAdminCustomerContact(db(), { actor, shop: { id: env().SHOP_ID } }, id)); } catch (error) { return failure(error); }
}

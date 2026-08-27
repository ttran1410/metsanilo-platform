import { db } from "@/db/client";
import { renewCustomerContact } from "@/domain/customers";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../../../response";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = await requirePermission(db(), request, "customers.retention.manage"); const { id } = await context.params; return success(await renewCustomerContact(db(), id, actor.email ?? actor.username ?? actor.id)); } catch (error) { return failure(error); }
}

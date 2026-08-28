import { db } from "@/db/client";
import { renewCustomerContact } from "@/domain/customers";
import { failure, success } from "../../../../../response";
import { authenticateAdmin } from "../../../../module";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const actor = (await authenticateAdmin(request, "customers.retention.manage")).actor; const { id } = await context.params; return success(await renewCustomerContact(db(), id, actor.email ?? actor.username ?? actor.id)); } catch (error) { return failure(error); }
}

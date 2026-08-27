import { db } from "@/db/client";
import { findRetentionEligibleCustomers } from "@/domain/customers";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../response";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "customers.retention.manage");
    return success({ customers: await findRetentionEligibleCustomers(db()) });
  } catch (error) {
    return failure(error);
  }
}

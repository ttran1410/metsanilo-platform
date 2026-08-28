import { findRetentionEligibleCustomers } from "@/domain/customers";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async () => undefined, run: async (_input, { database }) => ({ customers: await findRetentionEligibleCustomers(database) }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

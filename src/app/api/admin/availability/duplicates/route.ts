import { db } from "@/db/client";
import { findAvailabilityDuplicateGroups } from "@/domain/availability";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "availability.read");
    return success({ groups: await findAvailabilityDuplicateGroups(db()) });
  } catch (error) {
    return failure(error);
  }
}

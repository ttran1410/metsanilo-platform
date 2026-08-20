import { db } from "@/db/client";

import { requirePermission } from "@/domain/access";
import { getAvailabilityWorkspace } from "@/domain/availability";
import { failure, success } from "../../response";


export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "availability.read");
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const daysStr = searchParams.get("days");
    const days = daysStr ? Number(daysStr) : 7;
    const productId = searchParams.get("productId") ?? undefined;
    const seasonId = searchParams.get("seasonId") ?? undefined;

    const workspace = await getAvailabilityWorkspace(db(), {
      startDate,
      days,
      productId,
      seasonId,
    });

    return success(workspace);
  } catch (error) {
    return failure(error);
  }
}

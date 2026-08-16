import { db } from "@/db/client";
import { adminContext } from "@/app/admin/portal-auth";
import { requirePermission } from "@/domain/access";
import { failure, success } from "../../../response";
import { archiveManagerOrder, unarchiveManagerOrder } from "@/domain/orders";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { actor } = await adminContext();
    await requirePermission(db(), request, "orders.archive");

    const body = await request.json();
    const { ids, action = "archive" } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new DomainError("VALIDATION_ERROR", "No order IDs provided for batch operation.", 422);
    }

    const processedIds: string[] = [];
    const skippedActiveIds: string[] = [];

    for (const id of ids) {
      try {
        if (action === "unarchive") {
          await unarchiveManagerOrder(db(), id, actor.email ?? undefined);
        } else {
          await archiveManagerOrder(db(), id, actor.email ?? undefined);
        }
        processedIds.push(id);
      } catch (err: any) {
        if (err?.code === "INVALID_TRANSITION" || err?.status === 400) {
          skippedActiveIds.push(id);
        } else {
          throw err;
        }
      }
    }

    return success({
      action,
      processedCount: processedIds.length,
      processedIds,
      skippedActiveCount: skippedActiveIds.length,
      skippedActiveIds,
    });
  } catch (error) {
    return failure(error);
  }
}

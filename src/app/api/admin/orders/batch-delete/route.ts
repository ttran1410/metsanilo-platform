import { db } from "@/db/client";
import { adminContext } from "@/app/admin/portal-auth";
import { failure, success } from "../../../response";
import { deleteManagerOrder } from "@/domain/orders";
import { DomainError } from "@/domain/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { actor } = await adminContext();

    if (actor.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN", "Only Store Owner (ADMIN) accounts can permanently delete orders.", 403);
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new DomainError("VALIDATION_ERROR", "No order IDs provided for deletion.", 422);
    }

    const deletedIds: string[] = [];
    const skippedPaidIds: string[] = [];

    for (const id of ids) {
      try {
        await deleteManagerOrder(db(), id, actor.email ?? undefined);
        deletedIds.push(id);
      } catch (err: any) {
        if (err?.code === "PAYMENT_EXISTS" || err?.status === 400) {
          skippedPaidIds.push(id);
        } else {
          throw err;
        }
      }
    }

    return success({
      deletedCount: deletedIds.length,
      deletedIds,
      skippedPaidCount: skippedPaidIds.length,
      skippedPaidIds,
    });
  } catch (error) {
    return failure(error);
  }
}

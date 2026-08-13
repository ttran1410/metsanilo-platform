import { z } from "zod";
import { db } from "@/db/client";
import { addOrderNote } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.object({ body: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid note", 422);
    const { id } = await params;
    await requirePermission(db(), request, "orders.update");
    return success(await addOrderNote(db(), { orderId: id, ...parsed.data }), 201);
  } catch (error) {
    return failure(error);
  }
}

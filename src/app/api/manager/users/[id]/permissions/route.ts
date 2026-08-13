import { z } from "zod";
import { db } from "@/db/client";
import { PERMISSIONS, setUserPermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";

export const runtime = "nodejs";
const command = z.object({ permission: z.enum(PERMISSIONS), granted: z.boolean() });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid permission", 422);
    const { id } = await params;
    return success(await setUserPermission(db(), request, { userId: id, ...parsed.data }));
  } catch (error) { return failure(error); }
}

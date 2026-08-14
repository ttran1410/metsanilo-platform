import { z } from "zod";
import { db } from "@/db/client";
import { createPackage } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requirePermission(db(), request, "catalog.package.write"); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); return success(await createPackage(db(), (await params).id, parsed.data), 201); } catch (error) { return failure(error); }
}

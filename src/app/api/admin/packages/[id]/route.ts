import { z } from "zod";
import { db } from "@/db/client";
import { deletePackage, setDefaultPackage, updatePackage } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), package: z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean(), isDefault: z.boolean().optional(), sortOrder: z.number().int().optional() }) }), z.object({ action: z.literal("default") })]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { await requirePermission(db(), request, "catalog.package.write"); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); const id = (await params).id; return success(parsed.data.action === "default" ? await setDefaultPackage(db(), id) : await updatePackage(db(), id, parsed.data.package)); } catch (error) { return failure(error); } }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { await requirePermission(db(), request, "catalog.package.write"); return success(await deletePackage(db(), (await params).id)); } catch (error) { return failure(error); } }

import { z } from "zod";
import { db } from "@/db/client";
import { deletePackage, updatePackage } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

export const runtime = "nodejs";
const command = z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); return success(await updatePackage(db(), (await params).id, parsed.data)); } catch (error) { return failure(error); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { return success(await deletePackage(db(), (await params).id)); } catch (error) { return failure(error); } }

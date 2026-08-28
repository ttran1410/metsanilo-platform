import { z } from "zod";
import { createPackage, reorderPackages } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../../response";
import { executeAdmin, parseJson } from "../../../module";

export const runtime = "nodejs";
const command = z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean().default(true), isDefault: z.boolean().optional(), sortOrder: z.number().int().optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); return parsed.data; }, run: async (input, { database }) => createPackage(database, (await params).id, input) }); return success(result, 201); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async (incoming) => parseJson<{ packageIds?: unknown }>(incoming), run: async ({ packageIds }, { database }) => { if (!Array.isArray(packageIds) || packageIds.some((id) => typeof id !== "string")) throw new DomainError("VALIDATION_ERROR", "Package order is invalid", 422); return reorderPackages(database, (await params).id, packageIds); } }); return success(result); } catch (error) { return failure(error); } }

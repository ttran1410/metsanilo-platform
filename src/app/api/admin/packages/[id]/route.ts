import { z } from "zod";
import { deletePackage, setDefaultPackage, updatePackage } from "@/domain/products";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), package: z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean(), isDefault: z.boolean().optional(), sortOrder: z.number().int().optional() }) }), z.object({ action: z.literal("default") })]);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); return parsed.data; }, run: async (input, { database }) => { const id = (await params).id; return input.action === "default" ? setDefaultPackage(database, id) : updatePackage(database, id, input.package); } }); return success(result); } catch (error) { return failure(error); } }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async () => (await params).id, run: async (id, { database }) => deletePackage(database, id) }); return success(result); } catch (error) { return failure(error); } }

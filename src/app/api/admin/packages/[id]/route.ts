import { z } from "zod";
import { deleteAdminPackage, setAdminDefaultPackage, updateAdminPackage } from "@/domain/admin-products-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { executeAdmin, parseJson, type AdminExecutionContext } from "../../module";

export const runtime = "nodejs";
const command = z.discriminatedUnion("action", [z.object({ action: z.literal("update"), package: z.object({ labelFi: z.string(), labelEn: z.string(), volumeMl: z.number().int(), priceCents: z.number().int(), active: z.boolean(), isDefault: z.boolean().optional(), sortOrder: z.number().int().optional() }) }), z.object({ action: z.literal("default") })]);
const actionContext = (context: AdminExecutionContext) => ({ actor: context.actor, shop: { id: context.shop.shopId } });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async (incoming) => { const parsed = command.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid package command", 422); return parsed.data; }, run: async (input, { database, context }) => { const id = (await params).id; const action = actionContext(context); return input.action === "default" ? setAdminDefaultPackage(database, action, id) : updateAdminPackage(database, action, id, input.package); } }); return success(result); } catch (error) { return failure(error); } }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const result = await executeAdmin(request, { permission: "catalog.package.write", parse: async () => (await params).id, run: async (id, { database, context }) => deleteAdminPackage(database, actionContext(context), id) }); return success(result); } catch (error) { return failure(error); } }

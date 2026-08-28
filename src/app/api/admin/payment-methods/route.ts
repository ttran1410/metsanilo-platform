import { z } from "zod";
import { PAYMENT_METHODS } from "@/domain/payment-methods";
import { deleteAdminPaymentMethod, listAdminPaymentMethods, setAdminPaymentMethod } from "@/domain/admin-payment-method-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { executeAdmin, parseJson } from "@/app/api/admin/module";

export const runtime = "nodejs";
const command = z.object({ method: z.enum(PAYMENT_METHODS), enabled: z.boolean() });

export async function GET(request: Request) { try { return success(await executeAdmin(request, { permission: "settings.read", parse: async () => undefined, run: async (_input, { database, context }) => listAdminPaymentMethods(database, { actor: context.actor, shop: { id: env().SHOP_ID } }) })); } catch (error) { return failure(error, request); } }
export async function PUT(request: Request) { try { return success(await executeAdmin(request, { permission: "settings.operational", parse: async (input) => { const parsed = command.safeParse(await parseJson(input)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment method", 422); return parsed.data; }, run: (input, { database, context }) => setAdminPaymentMethod(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, input.method, input.enabled) })); } catch (error) { return failure(error, request); } }
export async function DELETE(request: Request) { try { return success(await executeAdmin(request, { permission: "settings.operational", parse: async (input) => { const method = new URL(input.url).searchParams.get("method"); if (!method) throw new DomainError("VALIDATION_ERROR", "Payment method parameter is required", 422); return method; }, run: (method, { database, context }) => deleteAdminPaymentMethod(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, method) })); } catch (error) { return failure(error, request); } }

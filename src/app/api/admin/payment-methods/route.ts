import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { deletePaymentMethod, listPaymentMethods, PAYMENT_METHODS, setPaymentMethod } from "@/domain/payment-methods";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { executeAdmin, parseJson } from "@/app/api/admin/module";

export const runtime = "nodejs";
const command = z.object({ method: z.enum(PAYMENT_METHODS), enabled: z.boolean() });

export async function GET(request: Request) { try { await requirePermission(db(), request, "settings.read"); return success(await listPaymentMethods(db())); } catch (error) { return failure(error); } }
export async function PUT(request: Request) { try { return success(await executeAdmin(request, { permission: "settings.operational", parse: async (input) => { const parsed = command.safeParse(await parseJson(input)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment method", 422); return parsed.data; }, run: (input, { database, context }) => setPaymentMethod(database, input.method, input.enabled, context.actor.email ?? context.actor.id) })); } catch (error) { return failure(error); } }
export async function DELETE(request: Request) { try { return success(await executeAdmin(request, { permission: "settings.operational", parse: async (input) => { const method = new URL(input.url).searchParams.get("method"); if (!method) throw new DomainError("VALIDATION_ERROR", "Payment method parameter is required", 422); return method; }, run: (method, { database, context }) => deletePaymentMethod(database, method, context.actor.email ?? context.actor.id) })); } catch (error) { return failure(error); } }

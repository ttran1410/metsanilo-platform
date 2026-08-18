import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { deletePaymentMethod, listPaymentMethods, PAYMENT_METHODS, setPaymentMethod } from "@/domain/payment-methods";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const command = z.object({ method: z.enum(PAYMENT_METHODS), enabled: z.boolean() });

export async function GET(request: Request) { try { await requirePermission(db(), request, "settings.read"); return success(await listPaymentMethods(db())); } catch (error) { return failure(error); } }
export async function PUT(request: Request) { try { const actor = await requirePermission(db(), request, "settings.operational"); const parsed = command.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid payment method", 422); return success(await setPaymentMethod(db(), parsed.data.method, parsed.data.enabled, actor.email ?? actor.username ?? actor.id)); } catch (error) { return failure(error); } }
export async function DELETE(request: Request) { try { const actor = await requirePermission(db(), request, "settings.operational"); const { searchParams } = new URL(request.url); const method = searchParams.get("method"); if (!method) throw new DomainError("VALIDATION_ERROR", "Payment method parameter is required", 422); return success(await deletePaymentMethod(db(), method, actor.email ?? actor.username ?? actor.id)); } catch (error) { return failure(error); } }

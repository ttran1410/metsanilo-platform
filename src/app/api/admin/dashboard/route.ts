import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { getDashboard } from "@/domain/dashboard";
import { failure, success } from "../../response";
export const runtime = "nodejs";
export async function GET(request: Request) { try { await requirePermission(db(), request, "orders.read"); return success(await getDashboard(db())); } catch (error) { return failure(error); } }

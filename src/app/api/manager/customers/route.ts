import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { searchCustomers } from "@/domain/customers";
import { failure, success } from "../../response";

export const runtime = "nodejs";
export async function GET(request: Request) { try { await requirePermission(db(), request, "orders.read"); return success(await searchCustomers(db(), new URL(request.url).searchParams.get("q") ?? "")); } catch (error) { return failure(error); } }

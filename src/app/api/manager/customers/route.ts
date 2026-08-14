import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { listCustomers, searchCustomers } from "@/domain/customers";
import { failure, success } from "../../response";

export const runtime = "nodejs";
export async function GET(request: Request) { try { await requirePermission(db(), request, "customers.read"); const query = new URL(request.url).searchParams.get("q") ?? ""; return success(query.trim().length >= 2 ? await searchCustomers(db(), query) : await listCustomers(db())); } catch (error) { return failure(error); } }

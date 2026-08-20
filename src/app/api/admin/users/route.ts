import { z } from "zod";
import { db } from "@/db/client";
import { createUser, listUsers } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { searchUsers } from "@/domain/admin-search";

export const runtime = "nodejs";
const command = z.object({ email: z.string().email(), displayName: z.string(), role: z.enum(["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"]), password: z.string() });

export async function GET(request: Request) {
  try {
    if (hasListQuery(request)) return success(await searchUsers(db(), parseAdminListQuery(request), {
      role: adminQueryParam(request, "role"),
      active: adminQueryParam(request, "status") === undefined ? undefined : adminQueryParam(request, "status") === "active",
    }));
    return success(await listUsers(db(), request));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid user", 422);
    return success(await createUser(db(), request, parsed.data), 201);
  } catch (error) { return failure(error); }
}

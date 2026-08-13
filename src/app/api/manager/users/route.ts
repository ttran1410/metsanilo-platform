import { z } from "zod";
import { db } from "@/db/client";
import { createUser, listUsers } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const command = z.object({ username: z.string(), displayName: z.string(), role: z.enum(["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"]) });

export async function GET(request: Request) {
  try { return success(await listUsers(db(), request)); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid user", 422);
    return success(await createUser(db(), request, parsed.data), 201);
  } catch (error) { return failure(error); }
}

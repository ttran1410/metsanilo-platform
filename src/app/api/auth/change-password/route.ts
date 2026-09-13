import { z } from "zod";
import { db } from "@/db/client";
import { changeOwnPassword, currentAuthContext } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";

const command = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const database = db();
    const authContext = await currentAuthContext(database, request);
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid password format", 422);

    const result = await changeOwnPassword(
      database,
      {
        actor: {
          id: authContext.actor.id,
          role: authContext.actor.role,
          shopId: authContext.actor.shopId,
          email: authContext.actor.email,
        },
        shop: { id: authContext.actor.shopId },
      },
      parsed.data
    );

    const response = success(result, request);
    response.cookies.delete("better-auth.session_token");
    response.cookies.delete("__Secure-better-auth.session_token");

    return response;
  } catch (error) {
    return failure(error, request);
  }
}

import { z } from "zod";
import { db } from "@/db/client";
import { authenticateUser } from "@/domain/access";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "@/domain/session";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const inputSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Invalid email or password" }), { status: 401, headers: { "content-type": "application/json" } });
    const user = await authenticateUser(db(), parsed.data.email, parsed.data.password);
    const response = success({ email: user.email, mustChangePassword: user.mustChangePassword });
    response.cookies.set(SESSION_COOKIE, createSession(user.email!, user.sessionVersion, user.mustChangePassword), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge });
    return response;
  } catch (error) { return failure(error); }
}

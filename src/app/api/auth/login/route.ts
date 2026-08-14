import { z } from "zod";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { createSession, SESSION_COOKIE, sessionMaxAge } from "@/domain/session";
import { failure, success } from "../../response";

export const runtime = "nodejs";
const inputSchema = z.object({ username: z.string().min(1).max(80), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.username !== env().MANAGER_USERNAME || parsed.data.password !== env().MANAGER_PASSWORD) {
      return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Invalid username or password" }), { status: 401, headers: { "content-type": "application/json" } });
    }
    const user = await db().query.users.findFirst({ where: (users, { and, eq }) => and(eq(users.shopId, env().SHOP_ID), eq(users.username, parsed.data.username), eq(users.active, true)) });
    if (!user && parsed.data.username !== env().MANAGER_USERNAME) return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 });
    const response = success({ username: parsed.data.username });
    response.cookies.set(SESSION_COOKIE, createSession(parsed.data.username), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAge });
    return response;
  } catch (error) { return failure(error); }
}

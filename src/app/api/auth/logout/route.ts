import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/domain/session";
export const runtime = "nodejs";
export async function POST() { const response = NextResponse.json({ data: { loggedOut: true } }); response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" }); return response; }

import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/domain/session";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const betterSession = request.cookies.get("better-auth.session_token") ?? request.cookies.get("__Secure-better-auth.session_token");
  if (betterSession) return NextResponse.next();
  if (session) {
    if (session.mustChangePassword && request.nextUrl.pathname !== "/admin/change-password" && request.nextUrl.pathname !== "/api/auth/change-password") return NextResponse.redirect(new URL("/admin/change-password", request.url));
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Authentication required.", { status: 401, headers: { "www-authenticate": 'Basic realm="METSÄNILO Manager", charset="UTF-8"' } });
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

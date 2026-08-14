import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/domain/session";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/manager/login" || request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (session.mustChangePassword && request.nextUrl.pathname !== "/manager/change-password" && request.nextUrl.pathname !== "/api/auth/change-password") return NextResponse.redirect(new URL("/manager/change-password", request.url));
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Authentication required.", { status: 401, headers: { "www-authenticate": 'Basic realm="METSÄNILO Manager", charset="UTF-8"' } });
  return NextResponse.redirect(new URL("/manager/login", request.url));
}

export const config = { matcher: ["/manager/:path*", "/api/manager/:path*"] };

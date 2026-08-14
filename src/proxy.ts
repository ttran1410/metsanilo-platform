import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/domain/session";

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/manager/login" || request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (readSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const password = process.env.MANAGER_PASSWORD;
  if (!password || password.length < 16) {
    return new NextResponse("Manager access is not configured.", { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const candidateUser = decoded.slice(0, separator);
      const candidatePassword = decoded.slice(separator + 1);
      // The pilot uses one configured Basic-auth secret; the username selects
      // the shop user and is authorized server-side by the RBAC layer.
      if (separator > 0 && candidateUser.length > 0 && equal(candidatePassword, password)) {
        return NextResponse.next();
      }
    } catch {
      // Invalid Authorization header falls through to a generic challenge.
    }
  }
  if (request.nextUrl.pathname.startsWith("/api/")) return new NextResponse("Authentication required.", { status: 401, headers: { "www-authenticate": 'Basic realm="METSÄNILO Manager", charset="UTF-8"' } });
  return NextResponse.redirect(new URL("/manager/login", request.url));
}

export const config = { matcher: ["/manager/:path*", "/api/manager/:path*"] };

import { NextResponse, type NextRequest } from "next/server";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";

export function proxy(request: NextRequest) {
  const correlationId = resolveCorrelationId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  const storefrontLocale = request.nextUrl.pathname.split("/")[1];
  if (storefrontLocale === "fi" || storefrontLocale === "en") {
    requestHeaders.set("x-storefront-locale", storefrontLocale);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasLegacyCookie = request.cookies.has("metsanilo_session");
  const authHeader = request.headers.get("authorization")?.trim();
  const hasBasicAuth = authHeader ? /^basic\s+/i.test(authHeader) : false;

  if (request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname.startsWith("/api/auth/")) {
    if (hasLegacyCookie) {
      recordLegacyAuthUsage(request, "legacy_cookie", 200, correlationId);
    }
    if (hasBasicAuth) {
      recordLegacyAuthUsage(request, "extraneous_basic", 200, correlationId);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const betterSession = request.cookies.get("better-auth.session_token") ?? request.cookies.get("__Secure-better-auth.session_token");
  if (betterSession) {
    if (hasLegacyCookie) {
      recordLegacyAuthUsage(request, "legacy_cookie", 200, correlationId);
    }
    if (hasBasicAuth) {
      recordLegacyAuthUsage(request, "extraneous_basic", 200, correlationId);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (hasLegacyCookie) {
      recordLegacyAuthUsage(request, "legacy_cookie", 401, correlationId);
    }
    if (hasBasicAuth) {
      recordLegacyAuthUsage(request, "extraneous_basic", 401, correlationId);
    }
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
        correlationId,
      },
      {
        status: 401,
        headers: {
          "x-correlation-id": correlationId,
        },
      },
    );
  }

  if (hasLegacyCookie) {
    recordLegacyAuthUsage(request, "legacy_cookie", 307, correlationId);
  }
  if (hasBasicAuth) {
    recordLegacyAuthUsage(request, "extraneous_basic", 307, correlationId);
  }

  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = { matcher: ["/fi/:path*", "/en/:path*", "/admin/:path*", "/api/admin/:path*"] };

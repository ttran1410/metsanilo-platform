import { NextResponse, type NextRequest } from "next/server";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";

function sanitizeNextUrl(url: URL): string | null {
  const pathname = url.pathname;
  const search = url.search;
  const fullPath = `${pathname}${search}`;
  if (fullPath.startsWith("/") && !fullPath.startsWith("//") && pathname !== "/admin/login") {
    return fullPath;
  }
  return null;
}

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

  // Early cookie presence gate for Edge routing performance. Authoritative session
  // validity and role authorization are strictly enforced downstream at the API/domain boundary.
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

  // Unauthenticated API request
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (hasLegacyCookie) {
      recordLegacyAuthUsage(request, "legacy_cookie", 401, correlationId);
    }
    if (hasBasicAuth) {
      recordLegacyAuthUsage(request, "http_basic", 401, correlationId);
    }
    return NextResponse.json(
      {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        correlationId,
      },
      {
        status: 401,
        headers: {
          "x-correlation-id": correlationId,
          "cache-control": "no-store, max-age=0",
        },
      },
    );
  }

  // Unauthenticated UI request
  if (hasLegacyCookie) {
    recordLegacyAuthUsage(request, "legacy_cookie", 307, correlationId);
  }
  if (hasBasicAuth) {
    recordLegacyAuthUsage(request, "http_basic", 307, correlationId);
  }

  const redirectUrl = new URL("/admin/login", request.url);
  const nextParam = sanitizeNextUrl(request.nextUrl);
  if (nextParam) {
    redirectUrl.searchParams.set("next", nextParam);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("x-correlation-id", correlationId);
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}

export const config = { matcher: ["/fi/:path*", "/en/:path*", "/admin/:path*", "/api/admin/:path*"] };

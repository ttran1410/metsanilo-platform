import { resolveCorrelationId } from "@/lib/correlation-id";

export type LegacyAuthMechanism = "login_endpoint" | "legacy_cookie" | "http_basic" | "extraneous_basic";

function statusClass(status: number) {
  return `${Math.floor(status / 100)}xx`;
}

export function recordLegacyAuthUsage(
  request: Request,
  mechanism: LegacyAuthMechanism,
  status: number,
  correlationId?: string,
) {
  const url = new URL(request.url);
  const resolvedCorrelationId = correlationId ?? resolveCorrelationId(request);
  console.info(
    "[legacy-auth-usage]",
    JSON.stringify({
      route: url.pathname,
      mechanism,
      timestamp: new Date().toISOString(),
      statusClass: statusClass(status),
      releaseSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      correlationId: resolvedCorrelationId,
    }),
  );
}

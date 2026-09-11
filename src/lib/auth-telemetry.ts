export type LegacyAuthMechanism = "login_endpoint" | "legacy_cookie" | "http_basic";

function statusClass(status: number) {
  return `${Math.floor(status / 100)}xx`;
}

export function recordLegacyAuthUsage(request: Request, mechanism: LegacyAuthMechanism, status: number) {
  const url = new URL(request.url);
  console.info("[legacy-auth-usage]", JSON.stringify({
    route: url.pathname,
    mechanism,
    timestamp: new Date().toISOString(),
    statusClass: statusClass(status),
    releaseSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    correlationId: request.headers.get("x-correlation-id") ?? "none",
  }));
}

export function getSafeAdminRedirect(targetUrl: string | null | undefined, fallback = "/admin"): string {
  if (!targetUrl || typeof targetUrl !== "string") return fallback;
  if (targetUrl.length > 512) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(targetUrl);
  } catch {
    return fallback;
  }

  if (decoded.length > 512) return fallback;
  // Reject control characters (0x00-0x1F, 0x7F)
  if (/[\x00-\x1F\x7F]/.test(decoded)) return fallback;
  // Reject backslashes or protocol-relative slashes
  if (decoded.includes("\\") || decoded.includes("//")) return fallback;

  // Split path from optional query/hash
  const [path] = decoded.split(/[?#]/, 1);
  if (path !== "/admin" && !path.startsWith("/admin/")) return fallback;

  // Prevent redirect loops
  if (path === "/admin/login" || path === "/admin/change-password") return fallback;

  return targetUrl;
}

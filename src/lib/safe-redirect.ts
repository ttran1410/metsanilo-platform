export function getSafeAdminRedirect(targetUrl: string | null | undefined, fallback = "/admin"): string {
  if (!targetUrl || typeof targetUrl !== "string") return fallback;
  if (targetUrl.length > 512) return fallback;

  // Reject double-encoding (%25xx)
  if (/%25[0-9a-fA-F]{2}/.test(targetUrl)) return fallback;

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

  // Split path from optional query
  const [pathPart, ...rest] = decoded.split("?");
  const queryPart = rest.length > 0 ? `?${rest.join("?")}` : "";
  const [cleanPath] = pathPart.split("#", 1);

  // Normalize path segments to avoid traversal (/admin/../storefront or /admin/../login)
  const segments = cleanPath.split("/");
  const normalizedSegments: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      normalizedSegments.pop();
    } else {
      normalizedSegments.push(seg);
    }
  }
  const normalizedPath = `/${normalizedSegments.join("/")}`;

  if (normalizedPath !== "/admin" && !normalizedPath.startsWith("/admin/")) return fallback;

  // Prevent redirect loops
  if (normalizedPath === "/admin/login" || normalizedPath === "/admin/change-password") return fallback;

  return `${normalizedPath}${queryPart}`;
}

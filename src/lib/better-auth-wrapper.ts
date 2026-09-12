export function withCorrelationHeader(response: Response, correlationId: string): Response {
  try {
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch {
    const rawSetCookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""].filter(Boolean);
    const headers = new Headers(response.headers);
    headers.set("x-correlation-id", correlationId);
    if (rawSetCookies.length > 1) {
      headers.delete("set-cookie");
      for (const cookie of rawSetCookies) {
        headers.append("set-cookie", cookie);
      }
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

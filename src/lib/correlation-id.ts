export const CORRELATION_ID_HEADER = "x-correlation-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveCorrelationId(request?: Request): string {
  const incoming = request?.headers.get(CORRELATION_ID_HEADER)?.trim();

  return incoming && UUID_PATTERN.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

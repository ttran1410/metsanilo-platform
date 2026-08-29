"use client";

type CachedQuery = { expiresAt: number; promise: Promise<unknown> };

const cache = new Map<string, CachedQuery>();
const CACHE_TTL_MS = 5_000;

export function getAdminQuery<T>(path: string, scope: string): Promise<T | null> {
  const key = `${scope}:${path}`;
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise as Promise<T | null>;

  const promise = fetch(path, { cache: "no-store", headers: { "x-admin-request-scope": scope } })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = await response.json();
      return (body.data ?? null) as T | null;
    })
    .catch(() => null);
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, promise });
  return promise;
}

export function invalidateAdminQuery(scope: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${scope}:`)) cache.delete(key);
  }
}

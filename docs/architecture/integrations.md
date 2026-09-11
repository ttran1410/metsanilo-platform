---
last_updated: 2026-09-10
document_type: reference
---

# External integrations

This inventory distinguishes implemented integrations from configured or future intent.

## Integration inventory

| System | Purpose | Configuration | Current caveat |
|---|---|---|---|
| Turso/libSQL | Primary transactional database | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Production CLI login was not active during audit |
| Better Auth | Admin credential/session provider | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, DB variables | Runs alongside legacy signed session; production preflight does not require its secret |
| Legacy admin session | Backward-compatible signed session | `ADMIN_SESSION_SECRET` | Must remain until migration is explicitly completed |
| Local filesystem | Development product/page media storage | `MEDIA_STORAGE=local`, `MEDIA_LOCAL_DIR` | Not shared across processes and not durable on Vercel |
| Vercel Blob | Production product/page media storage | `MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN` | Blob token is missing from `.env.example` and production preflight |
| Vercel | Next.js hosting/deployments | Ignored `.vercel/project.json`, cloud env vars | Local project is linked; auth identity was not confirmed |

No Google Maps/Routes, Meta/Facebook connector, WhatsApp connector, payment gateway, email provider, APM, or external message queue call is evidenced in production source.

## Data and reliability boundaries

- Turso holds shop, catalog, orders, customers, reviews, auth, permissions, audit, notifications, and outbox records.
- `src/lib/media-storage.ts` selects local storage outside production and Blob in production unless `MEDIA_STORAGE` overrides it. Database rows hold media metadata and URLs in both modes.
- Media deletion removes the external/local object before deleting database records. A storage success followed by database failure can leave inconsistent metadata; no compensating job is evidenced.
- `src/db/client.ts` caches one database instance per process. Do not treat process memory as shared state across Vercel instances.

## Secrets and observability

Environment variables provide credentials. `.env*` and `.vercel` are ignored. API failures include correlation IDs, but no central log retention, alerting, trace collection, or secret-rotation ownership is documented.

## Evidence

- `src/db/client.ts`
- `src/lib/better-auth.ts`
- `src/domain/session.ts`
- `src/domain/admin-media-actions.ts`
- `src/lib/media-storage.ts`
- `src/app/api/health/route.ts`
- `.env.example`
- `.gitignore`
- `.vercel/README.txt`

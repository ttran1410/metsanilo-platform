---
last_updated: 2026-08-30
document_type: explanation
---

# Architecture

Metsänilo is a single-process modular monolith. Next.js pages and HTTP adapters compose domain modules; domain modules own business behavior and use Drizzle/libSQL for persistence.

## Dependency direction

```text
Storefront/Admin UI and API routes (src/app)
                    ↓
Domain policies, actions, read models (src/domain)
                    ↓
Database schema/client (src/db) and runtime helpers (src/lib)
                    ↓
Turso/libSQL and Vercel Blob
```

`src/app` may compose domain and library modules. Domain code must not depend on React or browser-only state. Route handlers must not reproduce domain transactions. `src/db` exposes schema/client infrastructure, not product workflows.

## Representative public order call path

```text
POST /api/public/orders
  → route JSON parsing
  → orderInputSchema validation/normalization
  → createOrder in src/domain/orders.ts
  → one database transaction
     → idempotency lookup
     → product/package/availability checks
     → conditional capacity reservation
     → customer match/create
     → order snapshots + audit + notification/outbox
  → success/failure response with correlation ID
```

This path is capacity-sensitive and idempotent. Fixes belong in the transaction or its validation inputs, not in UI-only checks.

## Representative admin command path

```text
Admin component
  → /api/admin/... route
  → executeAdmin
     → currentUser (Better Auth, signed legacy session, Basic fallback)
     → shop membership check
     → permission check
     → boundary parser
     → typed admin action with actor/shop context
     → domain transaction/read model
  → success/failure response
```

`src/proxy.ts` only rejects obvious unauthenticated traffic. The route-level permission check is the authorization boundary.

## Frontend state

The codebase does not depend on a global state library. Server components provide initial shells/data where appropriate. Client components use React state, feature providers/controllers, URL state, and small shared query/reference-data caches under `src/app/admin/shared`.

Large workspaces have been decomposed into action controllers, query loaders, dialogs, lists, and details, but several workspace files remain over 800–1,200 lines. Preserve feature locality and extend an existing controller/provider before introducing a repository-wide state abstraction.

## Runtime processes

The repository has no separate worker service or queue consumer. `outbox_jobs` and an authenticated admin automation runner exist, but no committed scheduler/recovery deployment is evidenced. Health is exposed by `/api/health` and checks environment parsing plus `select 1` against the database.

## Evidence

- `src/app/api/public/orders/route.ts`
- `src/domain/order-input.ts`
- `src/domain/orders.ts`
- `src/app/api/admin/module.ts`
- `src/domain/access.ts`
- `src/proxy.ts`
- `src/app/admin/shared`
- `src/app/api/health/route.ts`
- `src/db/schema.ts`

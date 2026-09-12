---
last_updated: 2026-09-10
document_type: explanation
---

# System architecture

This is the canonical evidence-based architecture overview. Use the focused integration reference and engineering runbooks for detail.

## Product and runtime

Metsänilo is a seasonal berry storefront and fulfillment system for a single configured shop. Customers browse localized catalog data, reserve package quantities for a fulfillment date, and submit pickup or delivery orders. Staff operate orders, availability/capacity, products, customers, reviews, media, settings, reports, notifications, and users/permissions through `/admin`.

The application is a single Next.js 16 App Router project using React 19 and TypeScript. Public routes are under `src/app/[locale]` for `fi` and `en`; admin pages are under `src/app/admin`; HTTP handlers are under `src/app/api`. `src/proxy.ts` adds storefront locale headers and performs an early admin/API session gate.

## Layers and dependency direction

```text
Next pages/components and route handlers (src/app)
        ↓ compose
Domain actions/read models and policy (src/domain)
        ↓ use
Database client/schema (src/db) + runtime helpers (src/lib)
        ↓ persist/read
Turso/libSQL; local filesystem (development) or Vercel Blob (production) for media
```

`src/app` may compose domain and library modules. Domain code must not depend on React or browser state. Route handlers must not reproduce domain transactions. `src/db` exposes schema/client infrastructure, not product workflows.

## Representative public order path

```text
POST /api/public/orders
  → parse JSON and validate/normalize with orderInputSchema
  → createOrder in src/domain/orders.ts
  → one database transaction
     → idempotency lookup
     → product/package/availability checks
     → conditional capacity reservation
     → customer match/create
     → order snapshots, audit entry, and notification/outbox work
  → success/failure response with correlation ID
```

This path is capacity-sensitive and idempotent. A fix belongs in the owning validator, resolver, or transaction rather than in UI-only checks.

## Representative admin command path

```text
Admin component
  → /api/admin/... route
  → executeAdmin
     → authenticate current user
     → verify shop membership and permission
     → parse boundary input
     → call typed action with actor/shop context
  → domain transaction or read model
  → success/failure response
```

`src/proxy.ts` rejects obvious unauthenticated traffic early; it is not the authorization boundary.

## Frontend architecture and state

The storefront is server-rendered through localized App Router pages, with client components for forms, galleries, review flows, navigation, and validation. Admin pages compose module/workspace components. Larger admin areas use query loaders/controllers, URL-state modules, action controllers, dialogs/drawers, and workspace views; examples include `src/app/admin/orders`, `availability`, `customers`, and `products`.

Admin navigation is permission-aware, but server authorization remains authoritative. URL state and list-query parsing are explicit in `src/lib/admin-list-query.ts` and feature `url-state.ts` modules. No global client state library is evidenced in `package.json`; local React state, URL state, server queries, feature controllers, and small feature/request caches are the current patterns. Preserve feature locality before considering repository-wide client state.

## Backend and data flow

`src/db/client.ts` creates a typed Drizzle database over `@libsql/client`, cached per process. `src/db/schema.ts` defines SQLite tables and relations. `src/domain` contains catalog, availability, orders, customers, reviews, users/access, settings, reporting, notifications, themes, audit, and operational actions.

Public order creation is validated by `src/domain/order-input.ts`, resolves the matching harvest season and availability row through `src/domain/availability-resolver.ts`, resolves catalog/payment/location data, and reserves capacity inside a transaction in `src/domain/orders.ts`. The resolver accepts an exact season row and can fall back to one unambiguous legacy row without a season ID. Admin changes use action contexts and expected versions where concurrent edits matter. `src/app/api/response.ts` converts errors into stable JSON responses and emits a correlation ID.

## Runtime integrations and processes

Turso/libSQL is the primary relational store. Better Auth is the canonical authentication provider, with legacy session endpoints decommissioned and rollback credential mirrors maintained. `src/lib/media-storage.ts` selects local filesystem storage outside production and Vercel Blob in production unless configured otherwise.

The repository has no separate worker service or queue consumer. `outbox_jobs` and an authenticated admin automation runner exist, but no tracked scheduler or recovery deployment is evidenced. Migrations, seed, release, retention, and deployment run outside the web process.

The health endpoint validates runtime environment parsing and database connectivity. It does not validate migration level, Better Auth account mapping, Blob credentials, permissions, or order/capacity behavior.

See [External integrations](integrations.md) for configuration and reliability boundaries.

## Evidence

- `package.json`
- `.env.example`
- `src/app`
- `src/proxy.ts`
- `src/app/api/public/orders/route.ts`
- `src/app/api/admin/module.ts`
- `src/app/api/response.ts`
- `src/app/api/health/route.ts`
- `src/db/client.ts`
- `src/db/schema.ts`
- `src/domain/order-input.ts`
- `src/domain/orders.ts`
- `src/domain/availability-resolver.ts`
- `src/domain/access.ts`
- `src/domain/admin-media-actions.ts`
- `src/lib/media-storage.ts`

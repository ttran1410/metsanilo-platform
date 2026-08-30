---
last_updated: 2026-08-30
document_type: explanation
---

# System architecture

This document explains the evidence-based current architecture. Use the codebase reference for inventories and the engineering runbooks for procedures.

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
Turso/libSQL via Drizzle; Vercel Blob for media
```

Route handlers parse input, authenticate/authorize, call a domain action, and adapt results with `success`/`failure`. Admin routes commonly use `executeAdmin` from `src/app/api/admin/module.ts`; public order/review routes call domain functions directly and use the shared response adapter. Domain modules provide read models consumed by server-rendered pages and admin workspaces.

## Frontend architecture

The storefront is server-rendered through localized App Router pages, with client components for forms, galleries, review flows, navigation, and validation. Admin pages compose module/workspace components. Larger admin areas use query loaders/controllers, URL-state modules, action controllers, dialogs/drawers, and workspace views; examples include `src/app/admin/orders`, `availability`, `customers`, and `products`.

Admin navigation is permission-aware, but server authorization remains authoritative. URL state and list-query parsing are explicit in `src/lib/admin-list-query.ts` and feature `url-state.ts` modules. No global client state library is evidenced in `package.json`; local React state, URL state, server queries, and feature controllers are the current patterns. [TODO] Confirm whether any external runtime state/cache exists outside inspected source.

## Backend and data flow

`src/db/client.ts` creates a typed Drizzle database over `@libsql/client`, cached per process. `src/db/schema.ts` defines SQLite tables and relations. `src/domain` contains catalog, availability, orders, customers, reviews, users/access, settings, reporting, notifications, themes, audit, and operational actions.

Public order creation is validated by `src/domain/order-input.ts`, resolves catalog/availability/payment/location data, and reserves capacity inside a transaction in `src/domain/orders.ts`. Admin changes use action contexts and expected versions where concurrent edits matter. `src/app/api/response.ts` converts errors into stable JSON responses and emits a correlation ID.

## External/runtime integrations

- Turso/libSQL: primary relational persistence.
- Better Auth: parallel auth tables and handler at `/api/auth/better`.
- Legacy signed session: `metsanilo_session`, retained by `src/domain/session.ts` and `src/domain/access.ts`.
- Vercel Blob: product/CMS media upload/delete in `src/domain/admin-media-actions.ts`.
- Vercel deployment: ignored local project metadata exists in `.vercel/`; no repository CI workflow or tracked `vercel.json` was found.
- Operator processes: migrations, seed, release, retention, and deployment run outside the web process. See the migration and production deployment runbooks under `docs/engineering`.

The health endpoint validates runtime environment parsing and database connectivity. It does not validate migration level, Better Auth account mapping, Blob credentials, permissions, or order/capacity behavior.

Evidence: `package.json`, `src/app`, `src/proxy.ts`, `src/app/api/admin/module.ts`, `src/app/api/response.ts`, `src/db/client.ts`, `src/db/schema.ts`, `src/domain/orders.ts`, `src/domain/access.ts`, `src/domain/admin-media-actions.ts`.

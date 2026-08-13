# 13 — Recommended Technology Stack (Advisory)

This file is an implementation recommendation, not a business requirement. Teams may choose equivalent technologies if they preserve the architecture, transactional capacity rules, security, localization, accessibility, scheduler durability, and operability specified elsewhere.

## 1. Suggested MVP approach

A modular monolith minimizes operational complexity while providing clear domain boundaries.

| Layer | Possible choice | Reason |
|---|---|---|
| Public/shop-portal web | TypeScript + React framework with server rendering | Good mobile/public performance, shared typed UI, localization |
| Application/API | TypeScript service within modular application, or mature equivalent such as .NET/Java | Transactional domain services and shared contracts |
| Database | PostgreSQL | Transactions, row locking/conditional updates, constraints, JSON where useful, mature backup tooling |
| ORM/query | Framework with explicit transactions and migration support | Maintainable model without hiding locking/concurrency semantics |
| Jobs/outbox | PostgreSQL-backed durable job queue initially | Avoid extra infrastructure while guaranteeing retries/idempotency |
| Object/media | S3-compatible storage + CDN | Safe scalable media delivery |
| Portal authentication | Managed OIDC provider with MFA | Secure lifecycle/recovery without custom auth risk |
| Email | EU-compatible transactional email provider | Operational notifications in MVP |
| Address/routing | Google Address Validation API + Routes API `ComputeRoutes` | Finnish address normalization and server-authoritative shorter driving-route `distanceMeters` |
| Hosting | Managed EU-region application/database platform | Reduce operations and support data-location assessment |
| Observability | Structured logs + error tracking + metrics/tracing | Order/scheduler/provider diagnostics |
| PDF generation | Server-side HTML/CSS-to-PDF or mature document renderer with embedded fonts | Versionable invoice/report output and Unicode support |

## 2. Important implementation choices

- Use database-enforced atomic capacity reservation, not cache-only counters.
- Use transactional outbox for notification/scheduler commands.
- Keep CMS content structured; avoid unrestricted raw HTML.
- Keep public and admin bundles/routes separate enough to reduce data leakage and improve access control.
- Generate typed contracts and stable error codes.
- Use a real timezone library/database timezone behavior and a controllable clock in tests.
- Keep payment/customer-messaging and Google address/routing behind ports/interfaces; provider payloads never become the domain model.
- Put Google delivery calls behind a server-side effective-enablement guard and circuit breaker. Default shops off, invalidate outstanding automatic quotes on disable, and never call the provider from a disabled/fallback path.
- Keep report formula definitions/versioning in domain code and reconcile database aggregates to source facts.
- Render issued invoices only from immutable invoice snapshots and retain template/version/checksum metadata.

## 3. Avoid in MVP

- Microservices, event-streaming infrastructure, or separate search cluster without demonstrated scale need.
- Custom password/MFA implementation.
- Availability calculated only from browser state or eventually consistent analytics.
- A generic CMS that can modify prices/orders/capacity through untyped content.
- Exact 5 km claims based on postal code, straight-line browser math, or client-supplied distance. Use the approved server-side Google route result and manual fallback.

## 4. Selection checklist

The chosen stack must demonstrate:

- Atomic conditional update/locking and transaction rollback.
- Durable idempotent jobs and outbox processing.
- Finnish/English localization and Europe/Helsinki DST correctness.
- Fine-grained server authorization and audit.
- Accessible component primitives and safe rich-text/media processing.
- Encrypted backups with restore procedure.
- Provider/export path to avoid unnecessary lock-in.

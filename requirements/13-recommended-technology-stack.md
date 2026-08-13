# 13 — Recommended Technology Stack (Advisory)

> **v0.0.1 implementation boundary — ADR-0005 applies.** The proposed stack remains suitable, but deploy only a single-shop Next.js application with Turso/libSQL + Drizzle, managed authentication/MFA, image object storage, and deterministic invoice PDF rendering. Do not add Google Routes, Meta/WhatsApp, tenant provisioning, workers, video processing, or advanced reporting dependencies for the pilot.

This file is an implementation recommendation, not a business requirement. Teams may choose equivalent technologies if they preserve the architecture, transactional capacity rules, security, localization, accessibility, and operability specified elsewhere.

## 1. Suggested MVP approach

A modular monolith minimizes operational complexity while providing clear domain boundaries.

| Layer | Possible choice | Reason |
|---|---|---|
| Public/shop-portal web | TypeScript + React framework with server rendering | Good mobile/public performance, shared typed UI, localization |
| Application/API | TypeScript service within modular application, or mature equivalent such as .NET/Java | Transactional domain services and shared contracts |
| Database | Turso/libSQL | Managed SQLite-compatible relational storage with transactions and simple deployment |
| ORM/query | Drizzle ORM | Typed schema/migrations without hiding transaction semantics |
| Jobs/outbox | None required for v0.0.1; manual admin actions | Keep the two-day deployment small; add durable jobs after the pilot |
| Object/media | S3-compatible storage + CDN | Safe scalable media delivery |
| Portal authentication | Managed OIDC provider with MFA | Secure lifecycle/recovery without custom auth risk |
| Email | EU-compatible transactional email provider | Operational notifications in MVP |
| Address/routing | None in v0.0.1 | Delivery is always “Delivery to be agreed”; a future provider may be added behind an interface |
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
- Keep payment/customer-messaging and future routing behind ports/interfaces; provider payloads never become the domain model.
- Keep report formula definitions/versioning in domain code and reconcile database aggregates to source facts.
- Render issued invoices only from immutable invoice snapshots and retain template/version/checksum metadata.

## 3. Avoid in MVP

- Microservices, event-streaming infrastructure, or separate search cluster without demonstrated scale need.
- Custom password/MFA implementation.
- Availability calculated only from browser state or eventually consistent analytics.
- A generic CMS that can modify prices/orders/capacity through untyped content.
- Any distance-based delivery claim or client-supplied fee. The pilot uses manual “Delivery to be agreed”; a future route provider requires a new decision record.

## 4. Selection checklist

The chosen stack must demonstrate:

- Atomic conditional update/locking and transaction rollback.
- Basic retry/idempotency for order submission; durable jobs/outbox are future scope.
- Finnish/English localization and Europe/Helsinki DST correctness.
- Fine-grained server authorization and audit.
- Accessible component primitives and safe rich-text/media processing.
- Encrypted backups with restore procedure.
- Provider/export path to avoid unnecessary lock-in.

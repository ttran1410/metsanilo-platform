---
last_updated: 2026-08-30
document_type: reference
---

# Current product scope

This reference reconciles maintainers' product context with current code and tests. It does not copy the internal requirements set and does not promise missing behavior.

## Status definitions

| Status | Meaning |
|---|---|
| Implemented | Source, persistence/API behavior, and relevant tests exist |
| Partial | A usable slice exists, but an operational/security/UX part is missing |
| Deferred | Explicitly not required at the current stage |
| Divergent | Current implementation differs from an accepted tracked decision |
| Unknown | Code cannot establish the product/legal policy |

## Implemented scope

| Capability | Current contract | Evidence |
|---|---|---|
| Single-shop deployment | All product data is scoped to configured `SHOP_ID`; there is no tenant switcher/platform console | `src/lib/env.ts`, `src/domain`, `src/db/schema.ts` |
| Public storefront | Finnish and English catalog, information, reservation, and review routes | `src/app/[locale]`, storefront tests |
| Reservation orders | Shop-scoped idempotency, transactional capacity reservation, snapshots, customer matching, audit, and notification/outbox records | `src/domain/orders.ts`, `tests/order-api.test.ts` |
| Order lifecycle | Pickup/delivery paths plus controlled terminal outcomes and expected-version checks | `src/domain/order-transitions.ts`, transition tests |
| Availability | Daily integer-ml capacity, reserved volume, manual sold-out, cutoff controls, season windows, preview/planning, version/audit | `src/domain/availability.ts`, availability tests |
| Catalog | Products, packages, seasons, bilingual content, ordering/visibility, and media attachments | catalog/season/media modules and tests |
| Admin RBAC | `ADMIN`, `MANAGER`, `STAFF`, `CONTENT_CREATOR`; server route permissions and per-user grants | `src/lib/permissions.ts`, `src/domain/access.ts`, route contract tests |
| Customers | Contact normalization, identity conflict handling, marketing consent, contact confirmation, holds, retention review, anonymization | `src/domain/customers.ts`, customer tests |
| Reviews | Public/manual submission, moderation, verification, anonymous publication projection, featured state, replies | `src/domain/reviews.ts`, review tests |
| Operations | Dashboard, reports, notifications, audit, order source, fulfillment location, payment record, and theme workflows | admin routes/domain modules/tests |

## Partial scope and operational gaps

| Capability | Implemented portion | Missing or risky portion |
|---|---|---|
| Authentication | Better Auth plus legacy session compatibility | Migration completion, unified account lifecycle, and stronger production secret preflight |
| Automation | Outbox table, notification records, protected manual runner | No committed scheduler/worker recovery deployment |
| Media | Vercel Blob upload/delete and DB metadata | Blob credential preflight and cross-system compensation are missing |
| Retention | 24-month eligibility, 12-month contact confirmation, holds, dry-run/apply CLI, audit | Scheduled execution and approved production retention/backup interaction are not documented |
| Reporting | Existing-data sales, capacity, payment/refund, and customer reports | Accounting-grade cost, VAT, invoice, and profit sources are absent |
| Information pages | Fixed localized pages and selected visibility/media controls | No general page schema, revision history, or arbitrary CMS |
| Production delivery | Local scripts and CLI runbook | No committed CI/CD workflow, backup automation, or restore drill |

## Deferred at the current stage

The following capabilities are not release requirements unless a later tracked decision changes their status:

- MFA, under [ADR-0003](../adr/0003-mfa-not-current-release-gate.md);
- multi-shop provisioning, platform administration, subscriptions, and tenant switching;
- Facebook/WhatsApp inbox or synchronization connectors; links and metadata do not constitute integrations;
- Google route pricing/address validation; ordinary Google Maps links do not constitute an API integration;
- payment gateway authorization or automated reconciliation;
- invoice/order-summary PDF workflows and accounting exports;
- independent picker production, earnings, supplier, expense, and quality modules;
- Admin Finnish/Vietnamese localization;
- unrestricted CMS/page-builder behavior;
- fully unattended production deployment.

Permission names under `COMING_SOON_PERMISSIONS` are placeholders, not implementation evidence.

## Unknown policy

Code cannot establish legal retention periods for order snapshot PII, backup PII, audit records, or accounting documents. It also cannot establish business ownership for future integrations or compliance requirements. Keep these `[TODO]` until the owner/legal advisor confirms them.

## Evidence

- `src/app`
- `src/domain`
- `src/db/schema.ts`
- `src/lib/permissions.ts`
- `scripts`
- `tests`
- tracked ADRs under `docs/adr`

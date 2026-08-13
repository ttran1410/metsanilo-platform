# ADR-0006 — Incremental Deployable Releases v0.0.2–v0.1.0

**Status:** Accepted planning baseline  
**Date:** 2026-08-13  
**Scope:** Development cadence after the v0.0.1 reservation pilot

## Context

The repository already contains a working v0.0.1 pilot. The remaining approved scope is large enough that each change must be small, independently deployable, and easy to roll back. The team wants frequent commits and a production-capable checkpoint for every version.

## Decision

We will deliver nine additive releases: `v0.0.2` through `v0.0.9`, followed by `v0.1.0`. Each release must:

1. start from the previous production tag;
2. use a short-lived release branch;
3. preserve the previous public flow and database compatibility;
4. pass typecheck, lint, tests, build, migration, and smoke checks;
5. be deployable to Vercel/Turso before the next release begins;
6. be tagged only after production smoke verification; and
7. include a rollback note and a concise release commit/PR.

No release may include Google Routes, Facebook/WhatsApp, multi-shop organisation, supplier/expense/accounting modules, video media, or marketing automation.

## Release sequence

| Version | Deployable increment | Main outcome |
|---|---|---|
| `v0.0.2` | Foundation hardening | Reproducible Turso/Vercel deployment, migration/seed safety, environment validation, error handling, smoke-test baseline, and stable Manager pilot operation. |
| `v0.0.3` | Product module | Manager-authenticated pilot can CRUD products/packages, set localized names/descriptions and product availability windows; unreferenced delete/archive rules work. Role-specific Staff/Content Creator permissions become effective in `v0.0.6` when user/RBAC storage exists. |
| `v0.0.4` | Availability operations | Admin/Manager/permissioned Staff can manage day/week/month/custom capacity, edit the current day, set/clear sold-out, and see reserved/remaining litres without overselling. |
| `v0.0.5` | Order operations | Portal order list/detail, contact notes, state transitions, payment records, pickup confirmation, and manual delivery-fee entry with audit. Customer delivery remains “Delivery to be agreed.” |
| `v0.0.6` | Identity and permissions | Replace Basic-auth-only access with the four pilot roles: `ADMIN`, `MANAGER`, `STAFF`, `CONTENT_CREATOR`; add per-user feature permissions and Manager assignment to Staff/Content Creator. |
| `v0.0.7` | CMS and media | Fixed-page Finnish/English editor, draft/publish/preview/revision history, shop description/pickup instructions/product content, and maximum four images per page/product. |
| `v0.0.8` | Picking and invoices | Record-only external pickers; picking records with either litres or kilograms and unit-specific `€/L` or `€/kg` buy prices; invoice PDF issue/download and basic payment linkage. |
| `v0.0.9` | Release hardening | Accessibility, Finnish/English completeness, authorization/API tests, audit review, image/file limits, backup/restore notes, performance checks, and deployment runbook. |
| `v0.1.0` | Pilot launch baseline | All v0.0.1–v0.0.9 acceptance gates pass in production; tax-neutral invoice wording is approved, real shop data is seeded, rollback is rehearsed, and the pilot is declared live. |

## v0.0.2 implementation plan

### Objective

Make the existing v0.0.1 reservation pilot reproducible, safer to operate, and independently deployable. No new business module is included.

### In scope

1. **Environment and configuration safety**
   - Validate runtime variables with clear production-versus-local rules.
   - Reject weak/missing production Manager credentials and unsafe fallback values.
   - Keep local SQLite defaults available only for local development/tests.
   - Validate `Europe/Helsinki`, `fi/en`, shop identity, pickup data, and numeric seed values.
2. **Migration and seed safety**
   - Make migration execution explicit and fail clearly on connection/authentication errors.
   - Add a dry-run/preflight check and a documented production command order: migrate, verify, seed, smoke test.
   - Keep seed idempotent and prevent accidental reseeding of a different `SHOP_ID` or destructive changes to reservations/capacity.
   - Add a disposable-database migration/seed test.
3. **Runtime error and observability baseline**
   - Preserve correlation IDs for expected and unexpected API failures.
   - Add safe structured logging for request, database, migration, and seed failures without secrets or customer PII.
   - Add a stable health/readiness check that verifies configuration and database reachability without exposing data.
4. **Deployment reproducibility**
   - Verify the lockfile install, typecheck, lint, tests, and production build in a clean environment.
   - Document Vercel/Turso preview and production variables, region, migration procedure, smoke checks, and rollback.
   - Add a release version display/health metadata so the deployed commit can be identified.
5. **Smoke and regression coverage**
   - Keep the current four order tests and add health, invalid-environment, migration/seed, and production-like delivery/pickup smoke checks.
   - Verify Finnish `/fi`, English `/en`, privacy pages, public order, idempotency, sold-out, pickup details, delivery pending totals, Manager auth, and status/capacity mutation.

### Explicitly out of scope

Product CRUD, CMS, media upload, user accounts, role/permission redesign, payment records, invoices, picker records, picking quantity units, Google/Meta integrations, multi-shop, advanced notifications, and new domain tables.

### Planned commit sequence

1. `chore(v0.0.2): harden runtime environment validation`
2. `chore(v0.0.2): make migration and seed preflight-safe`
3. `feat(v0.0.2): add health and release metadata endpoints`
4. `test(v0.0.2): add deployment and smoke regression coverage`
5. `docs(v0.0.2): add deployment runbook and release notes`

### Completion gate

`npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass in a clean checkout; migration and seed succeed on a disposable libSQL database; preview deployment succeeds; production smoke checks pass; no secrets/PII appear in logs; and the previous v0.0.1 customer order path remains unchanged.

## v0.0.3 implementation plan — Product module

### Objective

Replace configuration-only catalog data with a protected Product module while preserving the existing public order flow. This release covers product identity, localized descriptions, packages, availability windows, and safe archive/delete behavior. It does not introduce the later user/RBAC, media, or capacity-planner modules.

### Scope and behavior

- Manager-authenticated users can list, create, edit, activate, deactivate/archive, and delete products when unreferenced.
- A product contains stable code/slug, Finnish and English name/description, inclusive `available_from`/`available_through`, active state, and audit timestamps.
- A package contains Finnish and English label, positive litres, non-negative EUR price, active state, and product association.
- Product and package validation is server-authoritative: names are required in both locales, descriptions are bounded plain text, code/slug is normalized and unique in the shop, dates are valid and ordered, litres are positive, and price is non-negative.
- A product/package referenced by an order, reservation, or retained availability fact cannot be hard-deleted; it can be archived/deactivated. Unreferenced deletion requires explicit confirmation and an audit event.
- The public catalog continues to show only active products/packages within their availability window. Existing order snapshots remain unchanged after catalog edits.
- No image/video upload, arbitrary CMS content, day/week/month capacity batch planner, or role-specific user assignment is included. `v0.0.3` uses the existing protected Manager gate; `v0.0.6` applies the four-role permission model.

### Data and API work

1. Add a forward-only Drizzle migration for localized product descriptions and any archive/update metadata required by the module.
2. Add typed product/package commands and queries under the single-shop server boundary.
3. Add API routes for product/package list, create, update, archive/deactivate, and guarded unreferenced delete.
4. Reuse the existing public catalog query and order snapshot logic; do not duplicate price/window validation in the client.
5. Add audit events for create, update, activate/deactivate, archive, package changes, and delete refusal/approval.

### Portal work

- Add a Products/Packages section to the Manager portal.
- Provide list/search/filter by active state and availability window.
- Provide create/edit form with Finnish/English fields, product window, package rows, price/litre validation, and archive/delete confirmation.
- Show reference counts or a clear “cannot delete because it is used by orders/reservations” explanation.
- Preserve accessible labels, keyboard operation, localized validation messages, and unsaved-change protection.

### Test and deployment work

- Migration test proves old v0.0.2 data migrates without changing existing order/catalog facts.
- Domain/API tests cover valid CRUD, duplicate code/slug, missing locale values, invalid dates, zero/negative litres, negative price, archive behavior, unreferenced delete, referenced delete refusal, authorization, audit, and public-order regression.
- Browser smoke test creates a product/package, activates it, orders it publicly, then verifies archive/delete protection and historical order snapshots.
- Deploy a Vercel preview, apply the migration to a disposable Turso/libSQL database, run smoke checks in Finnish and English, then promote only after the existing v0.0.2 journey remains green.

### Planned commit sequence

1. `feat(v0.0.3): add product description and archive schema`
2. `feat(v0.0.3): add product and package domain commands`
3. `feat(v0.0.3): add protected product module routes and portal`
4. `test(v0.0.3): cover catalog validation and reference safety`
5. `docs(v0.0.3): add product release notes and smoke checks`

### Completion gate

The release is deployable when a Manager can create and activate a bilingual product/package, the public site can order it, referenced catalog records cannot be deleted, unreferenced records can be deleted with audit, existing reservations/orders remain intact, and `npm ci`, typecheck, lint, tests, build, migration, preview smoke, and production smoke all pass.

## Git and deployment rule

`main` represents the latest production-approved state. For each version, create `codex/release-v0.0.x` (or `codex/release-v0.1.0`), make small commits, deploy the branch to a preview environment, merge after review, tag the merge commit, and deploy the tag/`main` to production. A release branch must not contain the next version’s unfinished work.

Suggested commit pattern:

```text
feat(v0.0.3): add product and package management
test(v0.0.3): cover product window and archive rules
docs(v0.0.3): record release notes and smoke checks
```

## Version completion gate

The version is not complete when code merely compiles. It is complete when the previous release still works, the new migration is applied to a disposable database, the critical user journey is tested in Finnish and English, authorization is tested at the API boundary, Vercel preview succeeds, production smoke checks pass, and the release tag/rollback reference is recorded.

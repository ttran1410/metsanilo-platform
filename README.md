# METSÄNILO v0.0.3 product-module pilot

The next work is split into nine independently deployable checkpoints (`v0.0.2`–`v0.0.9`, then `v0.1.0`). See [ADR-0006](requirements/decisions/0006-incremental-deployable-release-plan.md) and the [development tracker](requirements/19-development-plan-and-progress.md) before making the next code change.

This repository contains the intentionally narrow live pilot: one configured shop, bilingual public reservations, atomic capacity handling, a protected Manager view, and the Product module. v0.0.3 adds bilingual product/package CRUD with safe archive/delete behavior. It does not contain the later CMS, finance, payment, messaging, Google routing, analytics, or SaaS provisioning scope.

## Runtime and safety model

- Next.js App Router, TypeScript, Tailwind CSS, and accessible native controls.
- Vercel Node.js Functions for every database read and mutation. No business/database handler declares Edge runtime.
- Turso/libSQL through Drizzle. Money is integer cents; volume is integer millilitres.
- The server selects `SHOP_ID`; public or Manager payloads cannot select a tenant.
- A public order transaction conditionally increments reserved capacity only when sufficient capacity still exists, then writes the order and audit entries. The conditional update and unique shop-scoped idempotency key protect races and retries.
- Delivery has no provider implementation or dependency in this release. Its fee and final total are always `null` and the UI says “Delivery to be agreed.” Google Address Validation and Routes are therefore disabled and cannot be called.
- Manager access uses HTTPS Basic authentication with an environment-held password. Use a unique generated password of at least 16 characters. This is a pilot control, not the deferred full role/MFA system.

## Local setup

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
```

Fill every blank shop, pickup, product, package, date, capacity, and Manager value in `.env.local`. These are business inputs; the repository deliberately does not guess an identity, address, price, VAT position, legal wording, or production credentials.

For a local SQLite-backed libSQL database:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

For a deployment or production-like environment, run `npm run db:preflight` before migration. The health endpoint is `/api/health` and returns only readiness status, release metadata, and safe check results.

Seeding is intentionally guarded: use `SEED_DRY_RUN=true npm run db:seed` to validate inputs without writing, and set `SEED_ALLOW_EXISTING=true` only after reviewing an existing shop before an idempotent update. The seed refuses to run if the database contains a different shop.

Open `http://localhost:3000/fi`, switch to English at `/en`, and open `/manager` with `MANAGER_USERNAME` and `MANAGER_PASSWORD`.

## Turso migration and seed

Create the production Turso database outside this repository, then export a database URL and a least-privilege auth token:

```bash
export TURSO_DATABASE_URL='libsql://...'
export TURSO_AUTH_TOKEN='...'
npm run db:migrate
npm run db:seed
```

`db:seed` requires all `SHOP_*`, `PICKUP_*`, and `SEED_*` values shown in `.env.example`. It upserts the configured shop/product/package and creates missing daily availability without resetting existing reservations or Manager edits. Run migrations before seed. Do not run an unreviewed seed against a database belonging to another shop.

## Required production environment variables

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Production Turso/libSQL URL |
| `TURSO_AUTH_TOKEN` | Least-privilege production database token |
| `SHOP_ID` | Stable server-selected tenant identity; must match the seeded shop |
| `MANAGER_USERNAME`, `MANAGER_PASSWORD` | Protected Manager access; password must be 16+ characters |

The operator-only migration/seed environment additionally requires the following values. These do not need to be stored in Vercel after seeding:

| Variable | Purpose |
| --- | --- |
| `SHOP_SLUG` | Stable configured shop slug |
| `SHOP_NAME_FI`, `SHOP_NAME_EN` | Public configured shop names |
| `SHOP_TIMEZONE` | IANA zone; expected initial value `Europe/Helsinki` |
| `PICKUP_NAME_FI`, `PICKUP_NAME_EN` | Public pickup location names |
| `PICKUP_ADDRESS` | Complete customer-visible pickup address |
| `PICKUP_INSTRUCTIONS_FI`, `PICKUP_INSTRUCTIONS_EN` | Customer-visible instructions |
| `PICKUP_TIME` | Customer-visible local pickup time |
| `SEED_PRODUCT_CODE` | Stable product code |
| `SEED_PRODUCT_NAME_FI`, `SEED_PRODUCT_NAME_EN` | Localized product names |
| `SEED_PACKAGE_LABEL_FI`, `SEED_PACKAGE_LABEL_EN` | Localized package labels |
| `SEED_PACKAGE_ML` | Package size as a positive integer millilitre value |
| `SEED_PACKAGE_PRICE_CENTS` | Package price as positive integer euro cents |
| `SEED_AVAILABLE_FROM`, `SEED_AVAILABLE_THROUGH` | Inclusive `YYYY-MM-DD` product window |
| `SEED_DAILY_CAPACITY_ML` | Initial positive integer daily capacity in millilitres |

There are intentionally no Google API variables in v0.0.1.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The focused tests cover idempotent replay, the last-package concurrent race, one-time cancellation release, the public API, manipulated quantity rejection, and delivery’s pending totals.

After starting locally or deploying, smoke-check:

1. `/fi` renders Finnish by default and the English switch reaches `/en`.
2. Positive dates expose exact remaining litres; zero/manual sold-out exposes only `Loppuunmyyty` / `Sold out`.
3. Pickup shows its configured address/instructions before submit and on success.
4. Delivery shows “Delivery to be agreed”; a success response has no delivery fee or final total.
5. Repeating one idempotency key returns one reference and reserves capacity once.
6. `/manager` challenges unauthenticated access; confirm/cancel and capacity/sold-out changes survive refresh.
7. Audit rows exist for order creation/status, capacity reserve/release/update, and sold-out set/clear.

## Vercel deployment

1. Create/link the Vercel project and add the runtime variables from the first table above to Production. Do not expose secrets with `NEXT_PUBLIC_` names.
2. Apply the Turso migration and reviewed seed from a trusted operator machine.
3. Deploy this branch with `vercel --prod` (or the connected Git branch), then run the smoke checks against the assigned HTTPS URL.
4. The bilingual privacy notice is published at `/fi/tietosuoja` and `/en/privacy`. Treat production launch as blocked until the real seller/shop inputs, pickup details, catalog/price/capacity, retention choices, and Finnish consumer-law wording are approved. The app never invents these values.

## Rollback

Promote the preceding known-good Vercel deployment (Dashboard **Deployments → … → Promote to Production**, or the equivalent Vercel CLI command). Do not roll back the Turso schema for this additive release. If intake must stop immediately, set manual sold-out on every live date or deactivate the shop directly through a reviewed database operation. Existing orders and audit history must be retained. Revoke the deployment’s Turso token if credentials may have been exposed.

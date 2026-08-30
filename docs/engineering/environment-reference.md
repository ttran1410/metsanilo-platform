---
last_updated: 2026-08-30
document_type: reference
---

# Environment reference

Use this reference to determine which process loads each variable. `.env.example` is the checked-in inventory, but implementation inspection found gaps noted below.

## Loading behavior

| Process | Loads automatically | Operator responsibility |
|---|---|---|
| `next dev`, `next build`, Vercel runtime | Next.js/Vercel environment | Configure the correct target environment |
| `npm run db:migrate`, `db:seed`, `db:preflight`, `db:release` | Shell environment only | Export variables or invoke Node with `--env-file` |
| `npm run db:migrate:production` | `.env.production.local` through Node `--env-file` | Run explicit production preflight first |
| Drizzle Kit generation | Shell environment through `drizzle.config.ts` | A DB connection is not needed to compare schema, but defaults can target `file:local.db` |

Never print, paste into logs, or commit secret values. `.env*` and `.vercel` are ignored; `.env.example` is the only allowed env template.

## Runtime variables

| Variable | Required by code | Production rule |
|---|---|---|
| `TURSO_DATABASE_URL` | Defaults to `file:local.db` | Must be remote when production preflight is active |
| `TURSO_AUTH_TOKEN` | Optional locally | Required by production preflight |
| `SHOP_ID` | Defaults to `shop-main` | Security/data-isolation boundary |
| `SHOP_SLUG` | Defaults to `metsanilo` | Required by runtime validation |
| `SHOP_TIMEZONE` | Defaults to `Europe/Helsinki` | Controls business dates/cutoffs |
| `ADMIN_SESSION_SECRET` | Optional locally | At least 32 characters in production preflight |
| `BETTER_AUTH_SECRET` | Better Auth uses a local fallback | Must be set securely in production, but current preflight does not enforce it |
| `BETTER_AUTH_URL` | Optional; auth module falls back locally | Set to the canonical production Better Auth endpoint |
| `BLOB_READ_WRITE_TOKEN` | Used implicitly by `@vercel/blob` | Required for media upload/delete; missing from `.env.example` and env schema |

`BETTER_AUTH_ENABLED` appears in `.env.example` and the local wizard but is not read by inspected application code. [TODO] Remove it or implement/document the toggle after product confirmation.

## Seed-only variables

`SHOP_NAME_*`, pickup/contact settings, `BOOTSTRAP_ADMIN_*`, `ADMIN_DISPLAY_NAME`, and `SEED_*` are consumed by `scripts/seed.ts`. They are not routine runtime requirements.

The seed is state-changing and not a harmless release check. It refuses an existing shop unless `SEED_ALLOW_EXISTING=true`; when allowed, it upserts the bootstrap admin password and sets `mustChangePassword=true`. `SEED_DRY_RUN=true` validates seed inputs without writing.

## Production validation gaps

`validateRuntimeEnvironment({ production: true })` currently checks remote Turso URL, Turso token, legacy session secret length, `SHOP_ID`, and `SHOP_SLUG`. It does not check `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, Vercel Blob credentials, canonical URL, or Vercel/Turso target identity.

Treat those omissions as checks the operator must perform until code-level preflight is strengthened.

## Evidence

- `.env.example`
- `.gitignore`
- `src/lib/env.ts`
- `src/lib/better-auth.ts`
- `src/domain/admin-media-actions.ts`
- `scripts/migrate.ts`
- `scripts/seed.ts`
- `scripts/release.ts`
- `package.json`

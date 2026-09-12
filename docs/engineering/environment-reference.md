---
last_updated: 2026-09-10
document_type: reference
---

# Environment reference

Use this reference to determine which process loads each variable. `.env.example` is the checked-in inventory, but implementation inspection found gaps noted below.

## Loading behavior

| Process | Loads automatically | Operator responsibility |
|---|---|---|
| `next dev`, `next build`, Vercel runtime | Next.js/Vercel environment | Configure the correct target environment |
| `npm run db:migrate`, `db:seed`, `db:preflight`, `db:release` | Shell environment only | Export variables or invoke Node with `--env-file` |
| `npm run db:migrate:production` | `.env.production.local` through Node `--env-file` | Forces production validation; still verify approval, target, and backup first |
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
| `BETTER_AUTH_SECRET` | Better Auth uses a local fallback | At least 32 characters in production preflight |
| `BETTER_AUTH_URL` | Optional locally; falls back to localhost | Must use canonical origin `https://metsanilo.vercel.app` in production preflight |
| `MEDIA_STORAGE` | `local` or `blob`; defaults to `local` outside production and `blob` in production | Use `blob` for durable Vercel production media |
| `MEDIA_LOCAL_DIR` | Defaults to `public/uploads` | Development-only filesystem location; don't use as durable Vercel storage |
| `BLOB_READ_WRITE_TOKEN` | Used implicitly by `@vercel/blob` in Blob mode | Required for Blob upload/delete; missing from `.env.example` and env schema |

`BETTER_AUTH_ENABLED` appears in `.env.example` and the local wizard but is not read by inspected application code. [TODO] Remove it or implement/document the toggle after product confirmation.

## Seed-only variables

`SHOP_NAME_*`, pickup/contact settings, `BOOTSTRAP_ADMIN_*`, `ADMIN_DISPLAY_NAME`, and `SEED_*` are consumed by `scripts/seed.ts`. They are not routine runtime requirements.

The seed is state-changing and not a harmless release check. It refuses an existing shop unless `SEED_ALLOW_EXISTING=true`; when allowed, it upserts the bootstrap admin password and sets `mustChangePassword=true`. `SEED_DRY_RUN=true` validates seed inputs without writing.

## Production validation gaps

`validateRuntimeEnvironment({ production: true })` currently checks remote Turso URL, Turso token, legacy session secret length, `BETTER_AUTH_SECRET` (>= 32 chars), `BETTER_AUTH_URL` canonical origin (`https://metsanilo.vercel.app`), `SHOP_ID`, and `SHOP_SLUG`. It does not check Vercel Blob credentials, canonical custom domain routing, or Vercel/Turso CLI target identity.

Treat those omissions as checks the operator must perform until code-level preflight is strengthened.

## Evidence

- `.env.example`
- `.gitignore`
- `src/lib/env.ts`
- `src/lib/better-auth.ts`
- `src/domain/admin-media-actions.ts`
- `src/lib/media-storage.ts`
- `scripts/migrate.ts`
- `scripts/seed.ts`
- `scripts/release.ts`
- `package.json`

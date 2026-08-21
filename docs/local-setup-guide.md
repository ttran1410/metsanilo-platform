# Local Setup & Deployment Guide

Step-by-step guide to set up, build, run, and deploy the Metsänilo platform — covering both the local database and code deployment.

---

## 1. Prerequisites

| Tool | Version | Required for |
| --- | --- | --- |
| Node.js | v20.9+ | Running the app, scripts, tests |
| npm | Bundled with Node | Package management |
| Turso CLI | Latest | Optional local dev DB wizard; required for production database operations |

Install the Turso CLI if you plan to use the guided dev-database wizard or manage production databases:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

---

## 2. Install Dependencies

```bash
git clone https://github.com/ttran1410/metsanilo-platform.git
cd metsanilo-platform
npm ci        # clean install from package-lock.json (recommended)
```

> Use `npm install` only if you intentionally want to update dependencies.

---

## 3. Configure Environment

Copy the sample environment file:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored — never commit it. Key variables:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Database connection (`file:` for local SQLite, `http(s)://` for Turso) | `file:local.db` |
| `TURSO_AUTH_TOKEN` | Auth token for remote Turso (empty for local) | *(empty)* |
| `SHOP_ID` / `SHOP_SLUG` | Shop identity used for data isolation | `shop-main` / `metsanilo` |
| `SHOP_NAME_FI` / `SHOP_NAME_EN` | Shop display names | — |
| `SHOP_TIMEZONE` | Business timezone | `Europe/Helsinki` |
| `PICKUP_*`, `CONTACT_*` | Pickup location and customer contact details shown on the storefront | — |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Initial admin account created by the seed script | — |
| `ADMIN_SESSION_SECRET` | Legacy signed-session secret (**min 32 chars**, required in production) | — |
| `BETTER_AUTH_SECRET` | Better Auth secret (**min 32 chars**) | — |
| `BETTER_AUTH_ENABLED` / `BETTER_AUTH_URL` | Better Auth toggle and callback URL | `true` / `http://localhost:3000/api/auth/better` |
| `SEED_*` | Seed-only product inputs (integer **cents** for price, integer **millilitres** for volume/capacity) | — |

Generate secrets locally:

```bash
openssl rand -hex 32
```

Run an environment validation check at any time:

```bash
npm run db:preflight
```

---

## 4. Set Up the Database

Choose **one** of the two local options.

### Option A — Plain local SQLite file (simplest)

Keep `TURSO_DATABASE_URL=file:local.db` in `.env.local`. No extra process needed; libSQL writes directly to the file.

### Option B — Guided wizard with a persistent Turso dev server

```bash
./scripts/setup-local-turso-dev.sh
```

The wizard starts `turso dev` (backed by a persistent SQLite file), writes all values into `.env.local`, generates auth secrets, asks for shop/pickup/admin/seed values, then runs preflight → migrate → seed for you.

- Keep the `turso dev` process running while using the app.
- Its output is logged to `.turso-dev.log`.

### Apply migrations

Generate migration SQL **only after schema changes** in `src/db/schema.ts` (never rewrite an applied migration):

```bash
npm run db:generate   # only after editing src/db/schema.ts
npm run db:migrate    # applies drizzle/*.sql to the configured database
```

### Seed initial data

```bash
npm run db:seed
```

Seed behavior:

- Requires all `SEED_*`, shop/pickup, and bootstrap-admin variables to be set.
- Creates the shop, one product + package, daily availability rows, and the bootstrap admin user.
- **Refuses to run if the shop already exists** unless you explicitly set `SEED_ALLOW_EXISTING=true`.
- Refuses if the database contains a *different* shop (single-shop invariant).
- Dry-run without writing: `SEED_DRY_RUN=true npm run db:seed`.

---

## 5. Run the App Locally

```bash
npm run dev
```

| URL | Surface |
| --- | --- |
| `http://localhost:3000/fi` | Storefront (Finnish) |
| `http://localhost:3000/en` | Storefront (English) |
| `http://localhost:3000/admin` | Admin portal (sign in with the bootstrap admin account) |

---

## 6. Verify & Build

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (integration tests create their own disposable file: databases)
npm run build       # production build (next build --webpack)
```

Run a single focused test file or case:

```bash
npx vitest run tests/order-api.test.ts
npx vitest run tests/order-api.test.ts -t "test name"
```

---

## 7. Production Deployment (Vercel + Turso)

### 7.1 Create the production database

```bash
turso db create metsanilo-prod
turso db show metsanilo-prod --url        # → TURSO_DATABASE_URL
turso db tokens create metsanilo-prod     # → TURSO_AUTH_TOKEN
```

### 7.2 Configure environment variables on Vercel

Set at minimum:

- `TURSO_DATABASE_URL` (remote `libsql://…` URL — `file:` URLs are rejected in production)
- `TURSO_AUTH_TOKEN`
- `SHOP_ID`, `SHOP_SLUG`
- `ADMIN_SESSION_SECRET` (**≥ 32 characters**)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- Seed inputs (`BOOTSTRAP_ADMIN_*`, `SEED_*`, shop/pickup/contact values) for the release step

Production preflight additionally enforces: remote database URL, non-empty `TURSO_AUTH_TOKEN`, and a 32+ character `ADMIN_SESSION_SECRET`.

### 7.3 Run the release gate (operator-only)

From a machine configured with the production variables:

```bash
npm run db:release
```

This runs, in order: production preflight → `db:migrate` → `db:seed` → verifies that the configured bootstrap admin exists as an active `ADMIN`. Do not bypass this with manual table edits.

Optionally validate configuration alone first:

```bash
RELEASE_PREFLIGHT=true npm run db:preflight
```

### 7.4 Deploy the application

Either push to the Git branch connected to Vercel, or use the CLI:

```bash
vercel --prod
```

Deployments are pinned to the `dub1` region via `vercel.json`.

---

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Seed refused: existing shop detected` | Intentional safety gate. Review your `.env.local` values, then re-run with `SEED_ALLOW_EXISTING=true`. |
| `Environment preflight failed: … must be a remote Turso URL` | You are running with production checks enabled but a `file:` database URL. Point `TURSO_DATABASE_URL` at your Turso instance. |
| Admin login fails after seeding | Confirm `BOOTSTRAP_ADMIN_EMAIL` matches the seeded account; the seed sets `mustChangePassword=true`, so expect a forced password change on first sign-in. |
| Storefront shows no products | Check seed availability dates (`SEED_AVAILABLE_FROM` ≤ today ≤ `SEED_AVAILABLE_THROUGH`) and daily capacity values. |
| Wizard's `turso dev` died | Inspect `.turso-dev.log`; ensure port `8080` is free, then restart the wizard or run `turso dev --db-file local.db --port 8080` manually. |

---

## Command Reference

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build (`next build --webpack`) |
| `npm start` | Serve the production build |
| `npm test` | Run Vitest suite |
| `npm run typecheck` / `npm run lint` | Type check / lint |
| `npm run db:generate` | Generate Drizzle migrations from schema (schema changes only) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed shop, catalog, availability, and admin |
| `npm run db:preflight` | Validate runtime environment |
| `npm run db:release` | Operator release gate: migrate + seed + verify admin |

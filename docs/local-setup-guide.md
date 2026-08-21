# Local Setup & Deployment Guide

Step-by-step guide to set up, build, run, and deploy the Metsänilo platform — covering both the local database and code deployment.

---

## 1. Prerequisites

| Tool | Version | Required for |
| --- | --- | --- |
| Node.js | v20.9+ | Running the app, scripts, tests |
| npm | Bundled with Node | Package management |
| Turso CLI | Latest | Remote dev/prod database management; also used by the local dev-database wizard |

Install the Turso CLI if you plan to use a remote Turso dev database, the guided local wizard, or production database operations:

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
| `TURSO_DATABASE_URL` | Database connection (`file:` for a local SQLite file, `libsql://…` for a remote Turso database) | `file:local.db` |
| `TURSO_AUTH_TOKEN` | Auth token for a remote Turso database (leave empty for `file:` databases) | *(empty)* |
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

> **Important — `db:*` scripts do not read `.env.local`.**
> Next.js (`npm run dev` / `npm run build`) loads `.env.local` automatically, but the tsx-based scripts (`db:migrate`, `db:seed`, `db:preflight`, `db:release`) read only your shell environment. Export the file before running them:
>
> ```bash
> set -a; source .env.local; set +a
> ```

Run an environment validation check at any time:

```bash
npm run db:preflight
```

---

## 4. Set Up the Database

Choose **one** of the three options.

### Option A — Plain local SQLite file (simplest)

Keep `TURSO_DATABASE_URL=file:local.db` in `.env.local`. No extra process needed; libSQL writes directly to the file.

### Option B — Remote Turso dev database (shared, persistent)

Use a real Turso cloud database for development. It survives restarts, needs no background process, and behaves exactly like production (same driver, same preflight rules).

1. Log in and create a dedicated dev database (do **not** reuse the production one):

   ```bash
   turso auth login
   turso db create metsanilo-dev
   turso db show metsanilo-dev --url      # → TURSO_DATABASE_URL (libsql://…)
   turso db tokens create metsanilo-dev   # → TURSO_AUTH_TOKEN
   ```

2. Put both values into `.env.local`:

   ```env
   TURSO_DATABASE_URL=libsql://metsanilo-dev-<your-org>.turso.io
   TURSO_AUTH_TOKEN=<token from the command above>
   ```

Notes:

- Non-production preflight accepts remote URLs as-is; no extra flags needed.
- The database is persistent and possibly shared — the seed safety gates (existing-shop refusal) still apply.
- Destroy and recreate freely while iterating: `turso db destroy metsanilo-dev`.

### Option C — Guided wizard with a persistent local Turso dev server

```bash
./scripts/setup-local-turso-dev.sh
```

The wizard starts `turso dev` (backed by a persistent SQLite file), writes all values into `.env.local`, generates auth secrets, asks for shop/pickup/admin/seed values, then runs preflight → migrate → seed for you.

- Keep the `turso dev` process running while using the app.
- Its output is logged to `.turso-dev.log`.

### Apply migrations

Generate migration SQL **only after schema changes** in `src/db/schema.ts` (never rewrite an applied migration):

```bash
set -a; source .env.local; set +a   # db:* scripts read shell env, not .env.local
npm run db:generate                 # only after editing src/db/schema.ts
npm run db:migrate                  # applies drizzle/*.sql to the configured database
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
- Does **not** provision Better Auth (`auth_users`/`auth_accounts`) — on a fresh database, admin sign-in needs the one-time provisioning step from [Troubleshooting](#8-troubleshooting).

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
| `Missing required seed variable: …` | The `db:*` scripts don't auto-load `.env.local`. Export it first: `set -a; source .env.local; set +a`, then re-run. |
| Connection/auth errors against remote Turso (`TURSO_AUTH_TOKEN` rejected, timeouts) | Confirm `TURSO_DATABASE_URL` starts with `libsql://` and matches `turso db show <name> --url`; regenerate the token with `turso db tokens create <name>`; check `turso auth whoami`. |
| `Environment preflight failed: … must be a remote Turso URL` | You are running with production checks enabled but a `file:` database URL. Point `TURSO_DATABASE_URL` at your Turso instance. |
| Admin login fails on a **freshly seeded** database (`Invalid email or password` with correct credentials) | Known gap: `db:seed` does not provision Better Auth. Run the one-off provisioning script in [Fresh database: admin sign-in fails](#fresh-database-admin-sign-in-fails-better-auth-provisioning). |
| Admin login fails after seeding (wrong email) | Confirm `BOOTSTRAP_ADMIN_EMAIL` matches the seeded account; the seed sets `mustChangePassword=true`, so expect a forced password change on first sign-in. |
| `INVALID_ORIGIN` at admin sign-in | Better Auth rejects browsers whose origin differs from `BETTER_AUTH_URL`. Make sure the URL in `.env.local` matches the port you actually browse (e.g. `http://localhost:3000/api/auth/better`). Beware stale exported shell variables overriding `.env.local` — check with `echo $BETTER_AUTH_URL`. |
| Storefront shows no products | Check seed availability dates (`SEED_AVAILABLE_FROM` ≤ today ≤ `SEED_AVAILABLE_THROUGH`) and daily capacity values. |
| Wizard's `turso dev` died | Inspect `.turso-dev.log`; ensure port `8080` is free, then restart the wizard or run `turso dev --db-file local.db --port 8080` manually. |

### Fresh database: admin sign-in fails (Better Auth provisioning)

**Why:** `/admin` sign-in authenticates through **Better Auth**, which uses its own `auth_users` + `auth_accounts` tables. `npm run db:seed` only writes the legacy `users` table, so a freshly migrated + seeded database has no Better Auth identity and every sign-in fails — even with the correct email and password.

**Fix:** provision the matching Better Auth rows once per fresh database (run from the repo root):

```bash
set -a; source <(sed -E 's/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/\1="\2"/' .env.local); set +a

cat > provision-admin.mts <<'EOF'
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { hashPassword } from "./src/domain/passwords";

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const id = `user-${process.env.SHOP_ID?.trim() || "shop-main"}-admin`;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL!.trim().toLowerCase();
const now = Date.now();

await client.execute({
  sql: `insert into auth_users (id, name, email, email_verified, image, created_at, updated_at)
        values (?, ?, ?, 1, null, ?, ?)
        on conflict(id) do update set name = excluded.name, email = excluded.email, updated_at = excluded.updated_at`,
  args: [id, process.env.ADMIN_DISPLAY_NAME?.trim() || "Shop Admin", email, now, now],
});

const account = await client.execute({
  sql: "select id from auth_accounts where user_id = ? and provider_id = 'credential' limit 1",
  args: [id],
});
const passwordHash = hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
if (account.rows.length === 0) {
  await client.execute({
    sql: `insert into auth_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
          values (?, ?, 'credential', ?, ?, ?, ?)`,
    args: [randomUUID(), id, id, passwordHash, now, now],
  });
} else {
  await client.execute({
    sql: "update auth_accounts set password = ?, updated_at = ? where user_id = ? and provider_id = 'credential'",
    args: [passwordHash, now, id],
  });
}

console.log("Better Auth admin provisioned:", email);
client.close();
EOF

npx tsx provision-admin.mts && rm provision-admin.mts
```

This mirrors exactly what the app's own `createUser` does (`src/domain/access.ts`) and is idempotent — safe to re-run after changing `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`.

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

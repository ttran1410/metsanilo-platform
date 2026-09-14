---
last_updated: 2026-09-10
document_type: how-to
---

# Run database migrations safely

Use this procedure to create and apply forward-only Drizzle migrations without bypassing shop, environment, or production safety checks. `src/db/schema.ts` is the schema source; `drizzle/*.sql` and `drizzle/meta/_journal.json` are the ordered history.

## Before you begin

You need a clean task branch, installed dependencies, and a disposable local database for validation. For production, you also need explicit authorization, authenticated Turso access, the exact database name, and production variables in `.env.production.local`.

Do not run `db:generate` unless `src/db/schema.ts` changed. Do not rewrite, reorder, rename, or delete an applied migration.

Migration 0044 adds unique partial indexes for availability rows with and without
a season. Before applying it, run `npm run db:preflight`. If it reports legacy
availability duplicates, stop and resolve each `(shop_id, product_id,
business_date)` group manually. The migration intentionally does not merge,
delete, or choose a winner, because capacity and season semantics require a
product decision. Re-run preflight after resolution, then apply the migration.

## Create a migration after a schema change

1. Update `src/db/schema.ts` in the same change as the behavior that needs the schema.
2. Run the generator:

   ```bash
   npm run db:generate
   ```

3. Inspect the new SQL and metadata diff. Check table rebuilds, `DROP TABLE`, foreign-key disable/enable pairs, nullability, defaults, indexes, data copies, and statement order.
4. Confirm the migration is additive or backward-compatible with the currently deployed application. If it is not, split the rollout into expand, application deploy/backfill, and contract phases.
5. Add data-preservation tests for any rebuild/backfill. Schema creation alone does not prove existing rows survive.

## Validate the full chain locally

From the repository root, apply every migration to a new disposable file database:

```bash
MIGRATION_TEST_DIR="$(mktemp -d)"
TURSO_DATABASE_URL="file:${MIGRATION_TEST_DIR}/migration-test.db" npm run db:migrate
```

Run the focused domain/API tests affected by the schema, then run the standard quality checks. Remove the temporary directory after verification.

For a migration that changes existing data, also copy representative sanitized fixtures into a disposable database, apply the migration, and assert row counts, constraints, and business invariants.

## Prepare a production migration

1. Authenticate and resolve the target without exposing tokens:

   ```bash
   turso auth whoami
   turso db show <production-db> --url
   ```

2. Pull the linked Vercel production environment into the ignored file:

   ```bash
   vercel env pull .env.production.local --environment=production --yes
   ```

3. Run production preflight explicitly. This command loads the file and forces production validation:

   ```bash
   RELEASE_PREFLIGHT=true node --env-file=.env.production.local node_modules/tsx/dist/cli.mjs scripts/preflight.ts
   ```

4. Confirm the preflight reports a remote database. Stop if it reports `local`, a `file:` URL, a missing token, or a target you cannot independently identify.
5. Create a recoverable Turso copy before a destructive or table-rebuild migration:

   ```bash
   turso db create <backup-db> --from-db <production-db> --wait
   ```

   Use the naming and retention baseline in the [proposed Turso backup and restore policy](backup-restore-policy.md). Record the source database, backup database, UTC timestamp, migration commit, purpose, and operator in the restricted release record. The owner must approve or adjust that proposal before treating it as an operational SLA.

## Apply and verify production migrations

After approval and backup verification, apply the repository migration script. This command loads `.env.production.local` and forces production checks:

```bash
npm run db:migrate:production
```

Verify the Drizzle migration table and application health:

```bash
turso db shell <production-db> "select id, created_at from __drizzle_migrations order by created_at desc limit 5;"
curl -fsS https://metsanilo.vercel.app/api/health
```

Then run focused smoke tests against safe read paths and one authorized non-destructive admin read. Never create test orders/customers in production unless the runbook explicitly defines cleanup and audit expectations.

## Recover from a failed migration

Vercel rollback changes application code only; it does not reverse Turso schema or data. Drizzle has no repository rollback command.

If a migration fails:

1. Stop deployment and writes when continued traffic can corrupt data.
2. Capture the migration output, commit SHA, database name, and health response without secrets.
3. Prefer a forward repair migration when the partially applied state is understood and recoverable.
4. Restore into a new Turso database and switch only under an approved incident decision, following the [restore procedure](backup-restore-policy.md); this can discard writes made after the snapshot. Do not destroy or overwrite the current production database during diagnosis.
5. Verify auth, order/capacity, customer, audit, and media-reference invariants before reopening traffic.

Do not edit `__drizzle_migrations` manually to make a failed deployment look successful.

## Evidence

- `src/db/schema.ts`
- `drizzle/meta/_journal.json`
- `drizzle/*.sql`
- `drizzle.config.ts`
- `scripts/migrate.ts`
- `src/lib/env.ts`
- `node_modules/drizzle-orm/libsql/migrator.js`
- Turso CLI 1.0.32 command help

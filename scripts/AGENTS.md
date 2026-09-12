# Operator script rules

- Treat migration, seed, release, retention, and backfill scripts as state-changing production code. Read the complete script and its environment loader before running it.
- Obtain explicit authorization before targeting a remote database or production deployment. Verify CLI identity, project/database name, URL class, shop ID, and backup plan without printing secrets.
- The repository owner is the production approver and credential owner. Create/use ephemeral Vercel or Turso credentials only after approval for the exact operation; scope them narrowly, avoid logs/files, and revoke or expire them after the release.
- `db:*` scripts read shell variables unless the invoking command explicitly uses `node --env-file`. Never assume Next.js env loading applies to scripts.
- Force `RELEASE_PREFLIGHT=true` for production preflight and migration. Stop if output identifies a local database or if the target cannot be independently confirmed.
- Do not use `db:release` for routine deploys: it runs seed. Review `SEED_ALLOW_EXISTING`, bootstrap credential updates, and forced password-change effects before any seed.
- Test schema changes on a fresh disposable database and with representative existing data when migrations rebuild/backfill tables.
- Follow `docs/engineering/ci-cd.md`, `docs/engineering/database-migrations.md`, `docs/engineering/backup-restore-policy.md`, and `docs/engineering/production-deployment.md`; report commands run, targets, results, and unverified assumptions without secret values.
- `audit:auth` (`scripts/audit-auth-readiness.ts`) runs database readiness verification before cutovers (verifying 100% active user credential coverage, bidirectional orphan checks, and role coverage).
- `smoke:auth` (`scripts/auth-readiness-smoke.ts`) executes live HTTP authentication smoke tests against a specified target URL (`AUTH_SMOKE_BASE_URL`), protecting against unintended execution on the canonical production origin unless `AUTH_SMOKE_ALLOW_PRODUCTION=true` is set.

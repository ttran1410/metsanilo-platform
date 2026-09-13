---
last_updated: 2026-09-11
document_type: how-to
status: current-manual-process
---

# CI/CD process for pull requests and production releases

Use this process to verify commits locally, merge pull requests safely, detect database work, deploy with owner approval, and verify the canonical URL `https://metsanilo.vercel.app/`. The repository currently uses local gates and does not contain a hosted CI workflow. It does contain a scheduled, read-only Turso token reminder; that workflow does not deploy or mutate credentials.

The owner confirmed on 2026-09-11 that local verification and manual production approval remain the operating model. GitHub Actions is not part of the current pipeline. Production must not auto-promote merely because `main` changes.

## Pipeline ownership

- Contributors run the tracked local verification commands before review and merge.
- Current production changes are performed locally after the required checks and explicit owner approval.
- Future hosted production jobs, if enabled, must run only from `main` after required checks and merge.
- A future hosted runner must protect the `production` environment with the repository owner as required reviewer; this environment is not currently configured.
- AI agents may prepare and execute approved jobs with ephemeral credentials under [ADR-0002](../adr/0002-manual-production-approval-and-ephemeral-credentials.md).
- Use one production concurrency group so two deployments cannot migrate/deploy simultaneously.

## Stage 1: Validate every change locally

For normal review, run:

```bash
npm run verify
```

Before merging or releasing, compare against the intended base and run migration detection:

```bash
npm run verify:release -- main
```

`verify:release` runs typecheck, lint, tests, and build. If schema or migration files changed, it rejects edits to existing migrations, requires a new SQL migration with a schema change, and applies the complete committed migration chain to a disposable local database. It never points this check at Turso.

For fast iteration and the optional pre-push hook, use `npm run verify:quick`. Use non-production test secrets to avoid Better Auth fallback warnings.

### Detect database changes

Compare the pull request with its merge base:

```bash
git diff --name-only origin/main...HEAD -- src/db/schema.ts drizzle scripts/migrate.ts scripts/seed.ts scripts/release.ts
```

Classify the result:

| Change | CI requirement |
|---|---|
| No schema/migration files | Run standard checks; no DB deploy job |
| `src/db/schema.ts` changed | Require a new reviewed migration unless the diff is proven non-persistent |
| New `drizzle/*.sql` | Apply the full chain to a fresh disposable DB and inspect destructive SQL |
| Existing migration modified/deleted/reordered | Fail the PR |
| Data-only migration | Require explicit migration label/review and idempotency/data-preservation tests |
| Seed/release script changed | Require operator/security review; never execute against remote DB in PR CI |

For schema changes, a maintainer may run `npm run db:generate` and must inspect and commit the generated migration. Do not generate or commit SQL automatically without review.

Apply the committed chain to a new database:

```bash
CI_DB_DIR="$(mktemp -d)"
TURSO_DATABASE_URL="file:${CI_DB_DIR}/migration-test.db" npm run db:migrate
```

For rebuilds/backfills, add a second test that starts from representative sanitized pre-migration data and verifies row preservation and domain invariants.

## Stage 2: Manual merge controls

Until hosted CI/branch protection is enabled, the owner verifies the following from the PR and local command output:

- current PR branch and reviewed diff;
- typecheck, lint, tests, and build;
- migration validation when DB files changed;
- at least one owner/maintainer approval;
- resolved review comments;
- no direct push except an explicit emergency procedure.

Merge by commit or squash according to repository preference. Record the final merge commit because deployment and migration detection use that SHA.

## Stage 3: Build the release plan after merge

Before mutating production, identify what is currently deployed. `/api/health` returns `release.commit` and `release.environment`:

```bash
curl -fsS https://metsanilo.vercel.app/api/health
```

Resolve the deployed commit, verify that it is an ancestor of the release commit, and inspect changes between them:

```bash
git diff --name-status <deployed-sha>...<release-sha>
git diff --name-only <deployed-sha>...<release-sha> -- src/db/schema.ts drizzle
```

Stop if the deployed SHA is unknown, not in repository history, or not an ancestor. A force-push/divergent deployment needs a manual release comparison.

### Choose the release path

| Result | Release path |
|---|---|
| No DB changes | Deploy application after owner approval |
| Additive/backward-compatible migration | Backup → migrate → verify DB → deploy app → verify alias |
| App can run before and after migration | Either order is possible, but document and test the selected order |
| Breaking migration | Use expand/contract across separate releases; never combine into one deploy |
| Seed/provisioning change only | Run a separately approved provisioning operation; do not use routine deploy |

If Vercel Git integration automatically promotes `main`, confirm it is disabled or ensure every migration is backward-compatible with both old and new application versions. [TODO] Confirm the current Vercel Git/promotion setting.

## Stage 4: Obtain approval and ephemeral credentials

Prepare a release summary containing:

- merge/release SHA and PR;
- changed modules and tests;
- migration classification and SQL risk;
- production database and Vercel project names;
- backup name and recovery plan;
- expected deployment URL and canonical alias;
- smoke tests and rollback compatibility.

The owner approves this exact plan. Only then may an agent create/use temporary credentials.

For Turso, prefer a short-lived token scoped to the production database and operation. The CLI supports expirations, for example:

```bash
turso db tokens create <production-db> --expiration 1d
```

Do not print or persist the returned token. In the audited CLI, one day is the practical short-expiry example and individual Turso database-token revocation is not exposed: `turso db tokens invalidate <database>` rotates keys and invalidates all existing database tokens. Do not run it as routine cleanup. Let the approved temporary token expire, or perform an owner-approved full rotation that also updates every legitimate client.

Vercel tokens must also be temporary and passed through protected environment/secret storage. Revoke an individual credential after the release when supported; otherwise record its expiry and residual access explicitly.

## Stage 5: Migrate when required

Follow [Run database migrations safely](database-migrations.md) and the [proposed backup policy](backup-restore-policy.md).

Production migration must force preflight:

```bash
RELEASE_PREFLIGHT=true node --env-file=.env.production.local node_modules/tsx/dist/cli.mjs scripts/preflight.ts
npm run db:migrate:production
```

Do not use `db:release` in this stage because it also seeds/bootstrap-updates production data.

## Stage 6: Deploy and verify Vercel

Deploy the exact approved release checkout:

```bash
vercel deploy --prod --yes
```

Capture and inspect the deployment-specific URL:

```bash
vercel inspect <deployment-url> --wait --timeout 3m
curl -fsS <deployment-url>/api/health
```

Resolve the alias through Vercel as well as HTTP and confirm it maps to the deployment just inspected:

```bash
vercel alias list
vercel inspect https://metsanilo.vercel.app
```

Then verify the canonical alias, which is the user-facing production URL:

```bash
curl -fsS https://metsanilo.vercel.app/api/health
curl -I https://metsanilo.vercel.app/fi
curl -I https://metsanilo.vercel.app/en
```

Confirm that the canonical health response reports the expected release commit/environment. Smoke-test affected read paths, admin authentication/permissions, and any migrated behavior. Health alone does not prove Blob, auth mapping, or order/capacity correctness.

If the canonical alias does not point to the approved deployment, stop and diagnose project/scope/promotion configuration. Changing it with `vercel alias set <deployment-url> metsanilo.vercel.app` is a separate production mutation and requires owner approval; never “fix” the alias by guessing a deployment.

## Stage 7: Complete or roll back

On success:

1. Record release SHA, deployment ID/URL, canonical health result, DB migration timestamp, backup, checks, operator, approver, and credential revocation.
2. Monitor errors and affected workflows during the agreed observation window.
3. Revoke individually revocable temporary access, record non-revocable token expiry, and schedule backup expiry.

If application code fails and the schema is backward-compatible:

```bash
vercel rollback <deployment-id-or-url> --yes
```

If schema/data is involved, do not assume Vercel rollback is safe. Use the database incident procedure and owner approval. Never overwrite production in place from a backup without preserving the failed/current database.

## Emergency releases

Emergency changes still require owner approval, exact target resolution, focused tests, production backup for DB changes, canonical alias verification, and a release record. Skipping unrelated checks must be explicit and documented; urgency does not authorize bypassing migration or credential safety.

## Deferred hosted or self-hosted automation

GitHub Free supports Actions. Standard GitHub-hosted runners are free for public repositories; GitHub Free private repositories receive a monthly included quota, and self-hosted runners are not charged by GitHub. Current details are documented by [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Repository visibility, Actions settings, security, and maintenance cost—not the plan name alone—should drive the choice.

If the owner revisits this decision, use the same `verify:release` entrypoint rather than maintaining a second validation definition. Add read-only PR jobs first. Keep production deployment manual until the owner explicitly accepts automated credentials and approval controls. Before enabling hosted production automation, verify enforced owner approval, ephemeral secret handling, serialized releases, deployed-SHA/alias checks, and database-aware rollback behavior. A self-hosted runner must be patched, isolated, and protected from untrusted fork code.

[TODO] Verify in Vercel that Git production auto-deploy/promotion is disabled or otherwise cannot bypass manual owner approval.

## Evidence

- `package.json`
- `vitest.config.ts`
- `scripts/preflight.ts`
- `scripts/migrate.ts`
- `scripts/seed.ts`
- `scripts/release.ts`
- `src/app/api/health/route.ts`
- `src/lib/release.ts`
- Vercel CLI 58.11.0 and Turso CLI 1.0.32 help

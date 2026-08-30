---
last_updated: 2026-08-30
document_type: how-to
---

# Deploy to production with Vercel and Turso CLI

Use this operator runbook to migrate the production Turso database, deploy the linked Vercel project, verify the canonical deployment, and understand rollback limits. Production mutation requires explicit user/operator authorization.

This is the manual execution companion to the [CI/CD process](ci-cd.md). The repository owner owns Vercel/Turso credentials and gives final production approval under [ADR-0002](../adr/0002-manual-production-approval-and-ephemeral-credentials.md). MFA is not a current release gate under [ADR-0003](../adr/0003-mfa-not-current-release-gate.md).

## Before you begin

You need:

- a reviewed commit/branch with passing required checks;
- Vercel CLI authenticated to the account/team that owns project `metsanilo`;
- Turso CLI authenticated to the account/group that owns the production database;
- the exact production database name and canonical URL;
- production environment variables configured in Vercel;
- an approved migration/backup plan when schema changes exist.

The local `.vercel/project.json` is ignored and identifies a linked project, but it does not prove your current CLI identity or authorization. During the 2026-08-30 audit, Turso CLI was installed but not logged in; Vercel identity output was inconclusive. Recheck on every operator host.

## Confirm targets and credentials

1. Confirm CLI versions and identities:

   ```bash
   vercel --version
   vercel whoami
   turso version
   turso auth whoami
   ```

2. If either identity is absent or wrong, stop and authenticate with the approved account. Do not use a personal or unrelated team/database target.
3. Confirm the Vercel project link and production database name through read-only CLI/dashboard inspection. Do not infer the Turso database from `TURSO_DATABASE_URL` text alone.
4. Confirm Vercel production has, at minimum, Turso URL/token, shop identity, both auth secret/URL settings, legacy session secret, and `BLOB_READ_WRITE_TOKEN` when media is enabled.
5. If an agent needs temporary access, the owner must approve the exact release first. Use the shortest practical expiry and least privilege, keep values out of logs and files, and record revocation/expiry without recording the secret.

## Pull and validate production configuration

Pull variables into a git-ignored file:

```bash
vercel env pull .env.production.local --environment=production --yes
```

Run the explicit production preflight:

```bash
RELEASE_PREFLIGHT=true node --env-file=.env.production.local node_modules/tsx/dist/cli.mjs scripts/preflight.ts
```

The current preflight does not validate Better Auth secret/URL, Blob credentials, canonical URL, or Vercel/Turso identity. Confirm those separately without printing values.

## Run quality and migration gates

1. Run the checks appropriate to the change:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

2. If schema changed, follow [Run database migrations safely](database-migrations.md), including disposable validation and the [proposed backup policy](backup-restore-policy.md).
3. If schema did not change, do not generate or apply a new migration merely as ceremony. Running the idempotent migrator is allowed only when the target has been verified and the release procedure calls for it.

Do not use `npm run db:release` for routine deployment. It always runs `db:seed`; on an existing shop it either fails or, with `SEED_ALLOW_EXISTING=true`, upserts bootstrap data and resets the bootstrap admin password/forced-change state. Reserve it for explicitly reviewed provisioning/reseed operations until the script is separated.

## Deploy and verify

Deploy the reviewed source to Vercel production:

```bash
vercel deploy --prod --yes
```

Capture the deployment URL from CLI output, then wait for completion and inspect metadata/logs:

```bash
vercel inspect <deployment-url> --wait --timeout 3m
```

Resolve the canonical alias and confirm it maps to the inspected deployment:

```bash
vercel alias list
vercel inspect https://metsanilo.vercel.app
```

Verify both the deployment URL and canonical alias over HTTP:

```bash
curl -fsS <deployment-url>/api/health
curl -fsS https://metsanilo.vercel.app/api/health
curl -I https://metsanilo.vercel.app/fi
curl -I https://metsanilo.vercel.app/en
```

The health endpoint proves environment parsing and a database `select 1`. It does not prove auth mapping, permissions, migrations, Blob credentials, order/capacity behavior, or background automation. Complete a safe smoke checklist for those affected areas.

If the canonical alias is missing or points elsewhere, stop and verify Vercel project/scope/promotion configuration. `vercel alias set <deployment-url> metsanilo.vercel.app` changes production routing and requires separate owner approval.

## Roll back application code

If the application deployment is bad and the database remains backward-compatible, roll Vercel back to a known deployment:

```bash
vercel rollback <deployment-id-or-url> --yes
```

Inspect the canonical alias and health endpoint after rollback. Do not use Vercel rollback when the old code cannot run against the migrated schema.

Database recovery is a separate incident action. Follow the recovery section in [Run database migrations safely](database-migrations.md); restoring a snapshot can lose newer writes.

## Report the release

Record the commit SHA, Vercel deployment ID/URL, canonical alias result, Turso database name, latest migration timestamp, backup identifier, checks run, smoke results, operator, and any unverified assumption. Never include tokens or secret values.

Revoke individually revocable temporary credentials immediately after verification, or confirm their configured expiry in the release record. Turso's `db tokens invalidate` rotates token keys and invalidates all existing database tokens, so never use it as routine cleanup for one temporary token; let the short-lived token expire unless the owner approves a coordinated full rotation. A successful deployment does not authorize keeping reusable agent credentials.

## Evidence

- `package.json`
- `scripts/preflight.ts`
- `scripts/migrate.ts`
- `scripts/release.ts`
- `scripts/seed.ts`
- `src/app/api/health/route.ts`
- `src/lib/release.ts`
- `.vercel/README.txt`
- Vercel CLI 58.11.0 and Turso CLI 1.0.32 command help

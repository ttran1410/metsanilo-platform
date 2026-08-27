# Customer retention release note

## Scope

This release adds customer contact confirmation, retention holds, retention review, and anonymization safeguards.

## Required production steps

1. Confirm the release branch contains migrations `0038` and `0039`; record the deployed commit and take the normal Turso backup/snapshot before mutating data.
2. Verify the production Turso URL, `TURSO_AUTH_TOKEN`, `SHOP_ID`, and a 32-character admin session secret. Never use `file:local.db` for release operations.
3. Run the production preflight explicitly (this prevents accidentally targeting a local database):

   ```bash
   NODE_ENV=production node --env-file=.env.production ./node_modules/.bin/tsx scripts/preflight.ts
   ```

4. Run the migration with the operator-only command:

   ```bash
   NODE_ENV=production node --env-file=.env.production ./node_modules/.bin/tsx scripts/migrate.ts
   ```

5. Verify the migration output names the configured Turso database, confirm the new customer columns exist, and confirm the customer count is unchanged.
6. Confirm ADMIN users receive `customers.retention.manage` and `customers.anonymize`; grant the permissions explicitly to other roles only where approved.
7. Run the existing-customer backfill in dry-run first:

   ```bash
   NODE_ENV=production node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention-backfill.ts --batch-limit=100
   ```

8. Review the report and audit impact. Only then run apply if the business owner approves:

   ```bash
   NODE_ENV=production node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention-backfill.ts --apply --batch-limit=100
   ```

9. Run retention eligibility as a dry-run and archive the JSON report:

   ```bash
   NODE_ENV=production node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention.ts --dry-run --batch-limit=100
   ```

10. Verify Admin Portal Customer detail: contact confirmation, retention hold, anonymization confirmation modal, permission gating, and audit entries.
11. Verify saved customer views and deep links: each filter (`all`, `vip`, `conflicts`, `consent`) must preserve the filter in the browser URL and keep list/detail behavior consistent.
12. Verify one ADMIN can confirm/renew contact and create/release a retention hold, while a non-admin without `customers.retention.manage` cannot see or call those actions.
13. Run the retention anonymization CLI only as an operator-approved batch: capture a dry-run report first, then apply the same batch limit after review. Archive both JSON outputs and stop if the rechecked count differs unexpectedly.

## Safety notes

- Do not enable a scheduled Vercel Cron in this release; automation is deferred.
- Retention `--apply` is transactional, re-checks eligibility, skips already anonymized records, and writes an audit event per mutation. Keep it operator-approved until governance sign-off.
- The backfill is idempotent and only targets customers without a confirmation.
- Orders, financial totals, and audit records are preserved.
- Customer identity fields are anonymized only after explicit confirmation or an approved future retention job.

## Verification checklist

- `npm test -- --run`
- `npm run lint` (warnings may remain; no new errors)
- `npm run typecheck`
- Production migration output confirms configured Turso database.
- Customer count and shop scope are unchanged.
- Audit entries exist for any migration/backfill changes.

## Rollback

Application rollback may restore the previous application version, but database columns are additive and should not be removed. Do not reverse anonymization through a database rollback. If a backfill is incorrect, stop further runs, preserve the audit report, and escalate for a data-governance decision.

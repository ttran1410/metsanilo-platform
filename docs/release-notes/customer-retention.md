# Customer retention release note

## Scope

This release adds customer contact confirmation, retention holds, retention review, and anonymization safeguards.

## Required production steps

1. Confirm the release branch contains migrations `0038` and `0039` and that production preflight passes.
2. Verify the production Turso URL, `TURSO_AUTH_TOKEN`, `SHOP_ID`, and admin session secret. Never use `file:local.db` for release operations.
3. Run the migration with the operator-only release command:

   ```bash
   node --env-file=.env.production ./node_modules/.bin/tsx scripts/migrate.ts
   ```

4. Verify the new customer columns exist and the existing customer count is unchanged.
5. Confirm ADMIN users receive `customers.retention.manage` and `customers.anonymize`; grant the permissions explicitly to other roles only where approved.
6. Run the existing-customer backfill in dry-run first:

   ```bash
   node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention-backfill.ts --batch-limit=100
   ```

7. Review the report and audit impact. Only then run apply if the business owner approves:

   ```bash
   node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention-backfill.ts --apply --batch-limit=100
   ```

8. Run retention eligibility as a dry-run and archive the JSON report:

   ```bash
   node --env-file=.env.production ./node_modules/.bin/tsx scripts/customer-retention.ts --dry-run --batch-limit=100
   ```

9. Verify Admin Portal Customer detail: contact confirmation, retention hold, anonymization confirmation modal, permission gating, and audit entries.

## Safety notes

- Do not enable a scheduled Vercel Cron in this release; automation is deferred.
- Do not run retention `--apply`; it remains gated until batch anonymization transaction and legal-hold workflow are approved.
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

---
last_updated: 2026-08-30
document_type: reference
status: proposed
---

# Proposed Turso backup and restore policy

This policy is a recommended starting point for the current single-shop deployment. It is not accepted until the repository owner confirms retention, cost, legal, and recovery targets.

## Recovery objectives

Use these initial targets while validating Turso plan capabilities:

| Period | Proposed recovery point objective | Proposed recovery time objective |
|---|---:|---:|
| Active harvest/ordering season | 1 hour | 4 hours |
| Off-season | 24 hours | 1 business day |

[TODO] Confirm whether the Turso plan provides point-in-time recovery at the required granularity. Pre-migration copies protect against deployment mistakes but do not by themselves meet a one-hour live-data RPO.

## Backup layers

| Layer | Trigger | Purpose | Proposed retention |
|---|---|---|---|
| Pre-change Turso copy | Before every schema migration, destructive backfill, retention apply, or high-risk bulk operation | Fast same-provider rollback/recovery source | 14 days after successful verification |
| Weekly encrypted export | Weekly during active season; monthly off-season | Account/provider-independent database copy | 8 weekly generations |
| Month-end encrypted export | End of each month | Longer recovery/history point | 12 months, subject to legal confirmation |
| Incident/legal hold | Security/data incident or explicit hold | Preserve investigation evidence | Until owner/legal release |

Backups contain customer PII and authentication data. Encrypt exported files, restrict access, log restore/download operations, and delete expired generations. Never store backups in the repository, CI artifacts without encryption, or public object storage.

## Naming

Use lowercase UTC names without secrets:

```text
Turso copy: metsanilo-prod-bkp-YYYYMMDD-HHmm-<shortsha>-<purpose>
Export:     metsanilo-prod-YYYYMMDD-HHmm-<shortsha>.db
Metadata:   metsanilo-prod-YYYYMMDD-HHmm-<shortsha>.json
```

Examples of `<purpose>` are `migration`, `retention`, and `incident`. If Turso name limits reject the full name, shorten `metsanilo-prod-bkp` but keep UTC time, commit, and purpose.

## Create backups

Before a migration, create a same-provider copy:

```bash
turso db create <backup-db> --from-db <production-db> --wait
```

For a point-in-time recovery candidate, if the Turso plan supports it:

```bash
turso db create <recovery-db> --from-db <production-db> --timestamp <RFC3339-time> --wait
```

Create an external export outside the repository:

```bash
turso db export <production-db> --output-file <secure-path>/<export-name>.db --with-metadata
```

The export may include a WAL or logical log companion file. Preserve all generated files together and encrypt them before upload/storage.

## Verify backups

For each backup:

1. Record source database, backup/export name, UTC time, commit, operation, operator, and checksum in a restricted release record.
2. Open the copy/export in an isolated environment.
3. Verify migration count, expected tables, representative row counts, shop ID, and `select 1`.
4. Do not send emails, notifications, Blob deletes, or other external side effects from restored data.

Run a restore drill quarterly and before each harvest season. A backup is not verified until a restore drill proves it can start the application and preserve order/capacity/auth invariants.

## Restore procedure

1. Declare an incident and stop risky writes/deployments.
2. Identify the last known-good commit and recovery point.
3. Restore into a new Turso database; do not destroy or overwrite the current production database.
4. Validate schema, shop scope, order/capacity totals, admin auth mapping, customers, payments, audit, and Blob references.
5. With owner approval, update Vercel production database URL/token to the recovery database.
6. Deploy compatible application code and verify `https://metsanilo.vercel.app/api/health` plus focused smoke tests.
7. Preserve the old database until reconciliation and incident review are complete.

Restoring a snapshot can lose writes after its recovery point. Record and reconcile that data loss explicitly.

## Approval required

The owner still needs to approve:

- the proposed RPO/RTO;
- 14-day, 8-week, and 12-month retention periods;
- encrypted backup storage location and access list;
- Turso plan/PITR capability and cost;
- legal retention treatment for customer/order/auth/audit data;
- who may authorize a restore.

## Evidence

- Turso CLI 1.0.32 `db create` and `db export` help
- `src/db/schema.ts`
- `docs/engineering/database-migrations.md`
- `docs/domain/current-product-scope.md`

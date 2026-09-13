---
last_updated: 2026-09-13
document_type: decision
---

# ADR-0004: Make Better Auth the canonical credential and session store

## Status

Accepted on 2026-09-13 for the local implementation and release rehearsal.

## Context

The application previously duplicated authentication state in `users.password_hash`,
`users.session_version`, and a legacy admin-session secret alongside Better Auth.
That duplication allowed credential drift and made session revocation dependent on
multiple mechanisms. `users` is still required for shop membership, role, active
status, and temporary-password policy, but it is not the authentication provider.

## Decision

Better Auth owns credential accounts and sessions. The `users` table owns shop-scoped
identity and authorization context only. Password changes and resets update the
Better Auth credential account and the user policy fields in one transaction, then
revoke the user's sessions in that same transaction. Role, permission, and active
status changes likewise revoke sessions transactionally.

The legacy columns are retired with a forward-only Drizzle migration. Historical
rehearsal fixtures may mention those columns, but application code and runtime
configuration must not use them.

## Consequences

- There is one runtime source of truth for passwords and sessions.
- Existing Better Auth credential rows are preserved during bootstrap reconciliation;
  reconciliation creates only missing identity/account rows.
- Rollback during the release window means restoring the database backup and
  deploying the previous application version; it does not recreate a second live
  credential authority.
- Local verification must cover migration integrity, foreign keys, auth graph
  completeness, password-change/reset rollback, and session revocation.

## Operational boundary

The migration is rehearsed only against disposable/local databases until the
release owner explicitly approves production backup, migration, and deployment.
The production runbook must verify the expected migration head and backup manifest
before applying the migration.

## Evidence

- `src/lib/better-auth.ts`
- `src/lib/auth-integration.ts`
- `src/domain/access.ts`
- `src/domain/admin-user-actions.ts`
- `src/db/schema.ts`
- `drizzle/0042_stormy_squadron_supreme.sql`
- `scripts/verify-schema-contract.ts`

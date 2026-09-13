---
last_updated: 2026-09-13
document_type: how-to
status: active
---

# Better Auth post-cutover closeout

This procedure applies after the application is serving the Better Auth contract
and migration `0042` has been applied. It closes the observation window without
introducing another authentication authority or changing the migrated schema.

## Temporary observation code

`src/lib/auth-telemetry.ts` and the legacy-detection branches in
`src/proxy.ts` and `src/domain/access.ts` are retained intentionally during the
post-cutover observation window. They only detect and log requests that
still carry the retired legacy cookie or Basic Auth signal; they do not
authenticate the request or provide a fallback identity. Treat this code as a
temporary closeout control, not as a permanent authentication boundary.

The `[legacy-auth-usage]` records are application log events, not a durable
counter. A request can produce more than one event when it passes through both
proxy and domain checks, so use correlation IDs when investigating volume. Before
starting the observation window, confirm that the production log provider can
query and retain these records for the complete window. If it cannot, add an
approved durable metric sink or record that the zero-event gate is unverified;
absence from incomplete logs is not proof of zero traffic.

After the observation window, remove it completely in a dedicated cleanup
release once all of the following are recorded in the release record:

1. a saved query or restricted evidence showing zero `[legacy-auth-usage]`
   events across the complete agreed window;
2. a client/request inventory confirming that no supported client calls the
   retired endpoints or sends the legacy cookie;
3. owner approval for the cleanup release; and
4. passing Better Auth-only authorization, session, and smoke tests.

The cleanup release must remove the telemetry module, its callers, and the
legacy detection branches together. Do not leave unused telemetry exports or
dead compatibility checks behind.

## Current release evidence

- Merged release: `3d4753c` (PR #302)
- Production deployment: `dpl_BPieiuSoz4sEhiprTdPGZBBk6FME`
- Canonical alias: `https://metsanilo.vercel.app`
- Database migration head: `0042`
- CLI-inspected pre-migration recovery copy: `metsanilo-production-backup-20260913-auth-cutover`
- Production schema contract: passed
- Production Better Auth readiness audit: passed
- Manual production smoke-test: completed by operator

## Closeout steps

1. **Observe** authentication, authorization, and database errors during the
   agreed observation window. Record timestamps and correlation IDs for any
   actionable event; do not record credentials or session tokens.
2. **Confirm evidence** in the release record: operator, UTC timestamps, smoke
   scenarios, approver reference, deployment ID, database name, migration head,
   and backup identifier.
3. **Resolve verification gaps**. The formal backup verifier requires a token
   authorized for the backup database; a CLI-only comparison is not equivalent
   to a passing `scripts/verify-backup.ts` run.
4. **Retain recovery points** until the observation window and the approved
   retention period have elapsed. Do not delete older copies solely because their
   counts differ from a newer snapshot; they represent earlier recovery points.
5. **Close the release** only after the owner records the final observation
   result and approves backup cleanup, if any.

## Recovery boundary

After `0042`, do not roll back to an application release that reads the retired
columns. Use a forward repair release or restore the verified copy into a new
database under the incident procedure. Never edit `__drizzle_migrations` manually.

## Compatibility cleanup inventory

The following items are intentionally staged rather than removed during the
first post-cutover release:

| Candidate | Current purpose | Removal gate | Planned action |
|---|---|---|---|
| `src/lib/auth-telemetry.ts` | Logs legacy cookie/Basic Auth observations | Complete retained logs show zero legacy events for the agreed window, with owner approval | Remove the mechanism and its callers from proxy/domain code |
| Legacy branches in `src/proxy.ts` and `src/domain/access.ts` | Detects and records legacy traffic | Telemetry is retired; Better Auth-only behavior is covered by tests | Keep only Better Auth session gating and authorization flow |
| `src/app/api/auth/login/route.ts` and `logout/route.ts` | Return 410 and clear stale cookies | Client inventory confirms no callers; one release of 410 behavior has passed | Delete routes, or retain minimal 410 tombstones if external clients may still call them |
| Legacy-cookie cleanup in active auth routes | Removes stale cookies opportunistically | 410 tombstone decision is recorded | Remove cleanup branches together with tombstone policy |
| `scripts/auth-readiness-smoke.ts` legacy endpoint assertions | Verifies the temporary 410 contract | Tombstones are removed or policy explicitly makes them permanent | Replace with Better Auth-only smoke coverage, then delete obsolete assertions |
| Historical compatibility wording in docs | Explains pre-cutover behavior | N/A | Keep historical ADRs; update architecture/runbook docs when policy changes |

Do not remove `src/domain/passwords.ts` or `isSupportedPasswordHash`: the
Better Auth credential audit still validates the password format stored in
`auth_accounts.password`. Do not remove `users.username` based on this audit;
it remains a nullable read/display/search field by contract.

## Evidence commands

```bash
RELEASE_PREFLIGHT=true node --env-file=.env.production.local \
  node_modules/tsx/dist/cli.mjs scripts/preflight.ts

RELEASE_PREFLIGHT=true node --env-file=.env.production.local \
  node_modules/tsx/dist/cli.mjs scripts/verify-schema-contract.ts

RELEASE_PREFLIGHT=true node --env-file=.env.production.local \
  node_modules/tsx/dist/cli.mjs scripts/audit-auth-readiness.ts --target=production
```

Do not put production manifests, exports, tokens, or customer data in this
repository. Store restricted release evidence according to the documentation
governance policy.

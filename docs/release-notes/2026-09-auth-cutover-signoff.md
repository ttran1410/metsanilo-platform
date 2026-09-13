---
last_updated: 2026-09-13
document_type: release-record
status: closed
---

# Better Auth cutover release record

## Completed evidence

- PR: `#302`
- Merged release: `3d4753c`
- Vercel deployment: `dpl_BPieiuSoz4sEhiprTdPGZBBk6FME`
- Canonical alias verified: `https://metsanilo.vercel.app`
- Turso database: `metsanilo-production`
- Pre-migration head: `0041_noisy_legion`
- Post-migration head: `0042_stormy_squadron_supreme`
- Backup: `metsanilo-production-backup-20260913-auth-cutover` (direct CLI inspection passed; formal verifier pending)
- Schema contract verification: passed
- Better Auth readiness audit: passed
- Manual production smoke-test: completed

The application cutover and schema contract are complete. The owner approved
closeout with the documented observation/log and backup-verification exceptions
below.

Agent verification attempt on 2026-09-13: Vercel CLI identity resolved to the
release operator, but both the telemetry-deployment query and the project-level
14-day query returned no log records. This is recorded as `UNKNOWN`, not zero:
the available output does not distinguish zero matching events from expired or
inaccessible runtime logs. The owner must confirm the log provider's retention
and query coverage before accepting the observation gate. The owner accepted
this as a closeout exception.

## Operator closeout

- Operator: `ttran1410`
- Owner approval reference: `Direct owner approval in Codex conversation, 2026-09-13`
- Observation window: `2026-09-13T00:00:00Z - 2026-09-13T16:53:43Z` (owner-approved exception to the standard 48-hour window)
- Legacy telemetry evidence: `UNKNOWN — owner-approved exception; Vercel CLI queries returned no records, but complete historical retention/query coverage could not be proven. Supported client scope is web-only; repository inventory found no legacy callers.`
- Smoke scenarios and result: `Better Auth-only test suite and manual production smoke-test passed; no unresolved high-severity auth issue was reported.`
- Formal `scripts/verify-backup.ts` result: `Approved exception — formal verifier was not run before cleanup; backup target was independently identified and then deleted by explicit owner approval.`
- Backup cleanup decision: `Deleted by explicit owner approval on 2026-09-13; target metsanilo-production-backup-20260913-auth-cutover; parent production database was not targeted.`

Do not add credentials, tokens, production exports, customer data, or private
incident details to this public release record.

---
last_updated: 2026-09-13
document_type: release-record
status: pending-owner-closeout
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

## Operator closeout

- Operator: `[TODO: record operator]`
- Owner approval reference: `[TODO: record approval/reference]`
- Observation window: `[TODO: record UTC start and end]`
- Legacy telemetry evidence: `[TODO: record retained-log query/result for the complete window]`
- Smoke scenarios and result: `[TODO: attach restricted evidence or summarize]`
- Formal `scripts/verify-backup.ts` result: `[TODO: rerun with backup-authorized token, or record approved CLI-only exception]`
- Backup cleanup decision: `[TODO: retain or delete by approved retention policy]`

Do not add credentials, tokens, production exports, customer data, or private
incident details to this public release record.

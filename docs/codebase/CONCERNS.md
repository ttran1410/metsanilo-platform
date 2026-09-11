---
last_updated: 2026-09-10
document_type: reference
---

# Codebase concerns

These concerns are evidenced risks or inconsistencies, not permission to broaden an unrelated change.

## High-priority concerns

| Severity | Concern | Impact | Evidence |
|---|---|---|---|
| High | `db:release` always runs seed | Routine releases can fail on an existing shop or, with `SEED_ALLOW_EXISTING=true`, reset bootstrap admin password and force password change | `scripts/release.ts`, `scripts/seed.ts` |
| High | Better Auth secret is optional in production validation | The auth module has a development fallback secret while production preflight only requires the legacy secret | `src/lib/env.ts`, `src/lib/better-auth.ts` |
| High | No committed backup/restore or migration rollback automation | App rollback cannot undo incompatible schema changes | `scripts`, `package.json`, Vercel/Turso CLI help |
| Medium | Internal requirements may diverge from implementation | The ignored internal tree can contain stale intent and must not silently override code/tests or tracked decisions | `.gitignore`, `docs/adr/0001-tracked-engineering-authority.md` |
| Medium | Vercel Blob credential is implicit and absent from production preflight | Media operations may fail after deployment despite app/database health passing | `src/lib/media-storage.ts`, `.env.example`, `src/lib/env.ts` |
| Medium | Dual authentication paths remain active | Session, account mapping, revocation, and migration behavior are harder to reason about | `src/domain/access.ts`, `src/domain/session.ts`, `src/lib/better-auth.ts` |

## Maintainability and runtime concerns

- Several admin workspaces exceed 800 lines; customer and settings workspaces exceed 1,200 lines.
- `src/domain/reviews.ts`, `orders.ts`, `customers.ts`, `availability.ts`, and `access.ts` are large/high-churn business modules.
- Many domain functions read `env().SHOP_ID` directly while newer admin adapters also pass shop context. This is safe only if both remain consistent and complicates future multi-shop evolution.
- Logging is console-based and has no repository-evidenced redaction, retention, alert, or trace policy.
- Media object/database updates are not atomic across the selected storage backend and libSQL. Local media is also process-local and unsuitable for durable Vercel production storage.
- No browser E2E, accessibility automation, coverage threshold, performance test, or production smoke pipeline is committed.

## Documentation divergences found during this audit

- Earlier codebase docs referenced removed flat admin paths and `src/lib/auth.ts`; current paths are feature folders and `src/lib/better-auth.ts`.
- README test counts and requirement verification snapshots are stale by design; counts must come from current command output.
- A local deployment guide claims `vercel.json` pins `dub1`, but no tracked `vercel.json` exists.
- Local requirement documents describe both intended and deferred behavior; source/tests prove implementation, while accepted product intent needs a committed authority decision.

## Confirmed owner decisions

- Keep `requirements/` internal and ignored. Reconcile accepted rules against code/tests before migrating them into tracked docs ([ADR-0001](../adr/0001-tracked-engineering-authority.md)).
- The repository owner controls production credentials and approves deployments. Agents may use explicitly approved, scoped ephemeral credentials ([ADR-0002](../adr/0002-manual-production-approval-and-ephemeral-credentials.md)).
- MFA is not a release gate at the current project stage; this is a temporary accepted risk with revisit triggers ([ADR-0003](../adr/0003-mfa-not-current-release-gate.md)).
- Local verification plus manual owner-approved production deployment is the current release model. GitHub Actions is deferred.

## Open operational decisions

1. [TODO] Approve or adjust the proposed backup RPO/RTO, naming, retention, encrypted storage, and restore-drill policy in [`backup-restore-policy.md`](../engineering/backup-restore-policy.md).
2. [TODO] Decide whether to split `db:release` into routine migration and one-time provisioning commands. Until then, CI/CD must run migration directly and must not invoke `db:release`.
3. [TODO] Verify that Vercel Git production auto-deploy/promotion cannot bypass the confirmed manual approval policy in [`ci-cd.md`](../engineering/ci-cd.md).

## Evidence

- `package.json`
- `scripts/migrate.ts`
- `scripts/release.ts`
- `scripts/seed.ts`
- `src/lib/env.ts`
- `src/lib/better-auth.ts`
- `src/domain/admin-media-actions.ts`
- `.env.example`
- `.gitignore`
- source line counts and 90-day git churn gathered on 2026-08-30

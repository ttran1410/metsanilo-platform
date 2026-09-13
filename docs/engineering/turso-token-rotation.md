---
last_updated: 2026-09-13
document_type: runbook
status: current-manual-process
---

# Rotate the production Turso token

The scheduled [Turso token rotation reminder](../../.github/workflows/turso-token-rotation-reminder.yml) checks the expiry metadata, canonical health endpoint, and (when configured) the presence of `TURSO_AUTH_TOKEN` in Vercel Production. It never reads, prints, creates, replaces, or revokes a token.

## Before rotation

- Confirm the target is `metsanilo-production` and the linked Vercel project is `metsanilo`.
- Obtain owner approval for the exact production rotation.
- Confirm a recent database backup and a rollback plan.
- Use a token scoped only to `metsanilo-production` with read/write access.

## Rotation

1. Create a new Turso token with an approved expiry. Keep the returned value only in a protected terminal/session.
2. Replace the Vercel Production `TURSO_AUTH_TOKEN` value without changing the database URL.
3. Deploy the current reviewed application.
4. Verify `https://metsanilo.vercel.app/api/health`.
5. Verify Better Auth login, session creation, and one approved database write path.
6. Keep the previous token available until the new deployment and smoke checks are confirmed. Do not use a global Turso key invalidation as routine cleanup.
7. Update `ops/turso-token-rotation.json` with the new token's creation and expiry dates in the same reviewed change.

## Failure handling

If health or smoke checks fail, restore the previous Vercel token and rollback only when the database remains compatible with the previous application. Do not revoke the previous token until the new credential is proven usable by the production deployment.

## Repository secrets for the reminder

Configure these GitHub Actions secrets if the Vercel environment-presence check is desired:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID` (only when the project belongs to a team)

The workflow does not need a Turso token because expiry is tracked as metadata and health is checked through the public endpoint.

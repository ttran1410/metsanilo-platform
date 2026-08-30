---
last_updated: 2026-08-30
document_type: decision
---

# ADR-0002: Require manual production approval and ephemeral automation credentials

## Status

Accepted on 2026-08-30 by the repository owner. Revisit before enabling fully automatic production deployment.

## Context

The project deploys to Vercel and uses Turso for production data. AI agents may prepare or execute approved operational steps, but the repository has no committed CI/CD workflow, credential broker, or automated production approval policy.

Long-lived personal credentials would increase blast radius. Fully automatic deployment is not approved at the current project stage.

## Decision drivers

- The repository owner must control production changes.
- Agents need enough delegated access to perform approved deployment work.
- Credentials must be short-lived, least-privilege, and absent from source/logs.
- The production URL must remain `https://metsanilo.vercel.app/`.

## Decision

The repository owner owns Vercel/Turso access, token rotation policy, and final production approval.

An AI agent may generate or use temporary credentials only after explicit approval for the named deployment. The agent must:

1. Resolve the exact Vercel project, Turso database, commit, and requested operation.
2. Request approval before creating credentials or changing remote state.
3. Use the shortest practical expiry and minimum permissions.
4. Keep credentials in ephemeral process/CI secret storage, never files committed to git.
5. Avoid printing credentials or embedding them in command history, logs, artifacts, or deployment metadata.
6. Revoke/delete temporary credentials after the deployment when the provider supports individual revocation, or rely on the approved short expiry and report the limitation. Do not rotate shared signing keys merely to revoke one temporary token.
7. Record non-secret evidence: operator, scope, expiry, deployment ID, database name, commit, and outcome.

Production CI/CD must use a protected `production` environment with the repository owner as required reviewer. Pull requests run verification only; production mutation starts only after merge to `main` and manual approval.

## Consequences

### Positive

- Every production deployment remains owner-approved.
- Temporary credentials limit exposure from agents or CI logs.
- The policy supports gradual automation without granting permanent authority.

### Negative

- Deployments require an approval handoff.
- Credential creation/revocation adds operational steps.

### Risks and mitigations

- Risk: a token outlives the deployment. Mitigation: expiry plus explicit revocation check.
- Risk: Turso token invalidation disrupts unrelated clients. Mitigation: Turso database tokens must be created with a short expiration; `turso db tokens invalidate` rotates database token keys and requires a separate owner-approved credential-rotation plan.
- Risk: an agent targets the wrong account/database. Mitigation: independent target verification before approval.
- Risk: Vercel Git integration deploys automatically on merge. Mitigation: confirm/disable automatic production promotion or require backward-compatible migrations until the controlled pipeline owns promotion.

## Evidence

- `.vercel/README.txt`
- `docs/engineering/production-deployment.md`
- `docs/engineering/ci-cd.md`
- Vercel CLI and Turso CLI command help audited on 2026-08-30

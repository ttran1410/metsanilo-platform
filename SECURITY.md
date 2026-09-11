# Security policy and engineering rules

This file defines repository-visible security expectations. Report suspected exposed credentials or personal data privately to the repository owner; do not open a public issue containing the material.

## Data and secret handling

- Never commit `.env*` files except `.env.example`, tokens, passwords, database exports, local databases, production logs, or customer personal data.
- Do not print session tokens, authorization headers, complete connection strings with credentials, full payment details, or unnecessary customer data in logs, tests, screenshots, release records, or agent output.
- Use synthetic or irreversibly sanitized fixtures. A copied production database is still sensitive even when stored locally.
- Treat media uploads and database backups as production data. Follow least privilege, encryption, retention, and deletion rules.

## Application boundaries

- Scope every database query and mutation by the configured shop or validated shop context.
- Admin navigation/UI flags are not authorization. Every Admin API route enforces authentication, membership, and permission server-side.
- Preserve both Better Auth and the signed legacy session path until an approved migration removes one.
- Parse untrusted input at the API boundary; enforce cross-record invariants again in the domain transaction.
- Return expected failures through `DomainError` and the shared response adapter. Do not expose stack traces or internal SQL details.

## Production authority

The repository owner owns Vercel/Turso credentials and approves each production migration, deploy, promotion, rollback, database copy, restore, token creation, or destructive operation. Agents may prepare commands and may use a release-specific, short-lived, least-privilege credential only after approval for the exact target and operation. Credentials must not be persisted in Git or output and must be revoked or allowed to expire as documented.

MFA is not currently a mandatory release gate; this is an accepted risk, not permission to weaken other controls. See `docs/adr/0002-manual-production-approval-and-ephemeral-credentials.md` and `docs/adr/0003-mfa-not-current-release-gate.md`.

## Incident minimum

If a secret or customer data may have entered Git history, logs, an artifact, or agent output:

1. stop using the credential or artifact;
2. notify the owner privately;
3. rotate/revoke the credential or restrict access;
4. preserve enough non-sensitive evidence to understand exposure;
5. clean current files and decide separately whether a coordinated history rewrite is required.

Deleting a file in a later commit does not remove it from Git history.

## Sensitive-data classification and Git history response

| Finding | Examples | Immediate response | History rewrite default |
|---|---|---|---|
| Active credential | Vercel/Turso/GitHub token, password, session/auth secret, private key, credential-bearing database URL | Revoke or rotate first; inspect access logs and dependent deployments | Consider after rotation when removal materially reduces residual exposure |
| Customer or staff PII | Personal email, phone, home/delivery address, Facebook profile, order-linked identity, Finnish personal identity code | Restrict access, notify the owner, determine affected people and privacy obligations | Usually consider; decide from scope, copies/forks, and legal/privacy impact |
| Payment or production data | Card/payment details, database export, backup, customer order rows, production logs | Isolate the artifact and follow incident handling | Usually consider; never treat deletion in a later commit as sufficient |
| Confidential business information | Unpublished roadmap, private pricing/margins, vendor terms, incident narrative, internal operating details | Assess commercial impact and whether disclosure is still harmful | Case by case; GitHub may not treat it as removable sensitive data |
| Public or synthetic information | Public business contact, placeholders, example credentials, synthetic fixtures, public URLs | Confirm that it is genuinely non-sensitive | Do not rewrite |

A detector match is not proof of exposure, and a clean pattern scan is not proof that prose contains no PII or confidential context. Review likely matches without copying values into tickets or logs. If an exposed credential is real, rotation is the first control because old clones, forks, pull-request refs, caches, and local copies may survive a rewrite.

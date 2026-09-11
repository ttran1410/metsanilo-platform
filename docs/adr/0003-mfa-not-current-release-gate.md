---
last_updated: 2026-08-30
document_type: decision
---

# ADR-0003: Do not require MFA for the current release stage

## Status

Accepted on 2026-08-30 by the repository owner as a temporary risk decision.

## Context

The application uses Better Auth and a legacy signed session path, but no MFA enrollment, challenge, recovery, or enforcement flow exists. Internal requirements previously treated MFA as a possible production gate.

The repository owner confirmed that MFA is not mandatory at the current project stage.

## Decision

Do not block current production deployment solely because MFA is absent.

This decision does not claim that password-only authentication satisfies a future security/compliance baseline. Continue to require:

- strong unique admin passwords;
- secure Better Auth and legacy session secrets;
- HTTPS and secure cookies in production;
- server-side permission enforcement;
- session revocation/version behavior;
- auditability for privileged operations;
- manual owner approval for production changes.

Keep MFA as deferred security hardening. Revisit this ADR before unattended deployment, adding more operators, handling higher transaction volume, responding to an account incident, or adopting a compliance requirement.

## Consequences

### Positive

- Current releases are not blocked by an unimplemented authentication feature.
- Maintainers have an explicit decision instead of conflicting requirement prose.

### Negative

- Compromised credentials have greater impact than with MFA.
- Dual authentication paths continue to increase review complexity.

### Risks and mitigations

- Risk: admin account takeover. Mitigation: strong passwords, secret rotation, short sessions, revocation, least privilege, and audit review.
- Risk: the temporary exception becomes permanent by inertia. Mitigation: use the revisit triggers above and supersede this ADR when MFA is implemented or required.

## Evidence

- `src/lib/better-auth.ts`
- `src/domain/session.ts`
- `src/domain/access.ts`
- `src/proxy.ts`
- `src/lib/permissions.ts`

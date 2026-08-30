---
last_updated: 2026-08-30
document_type: reference
---

# Architecture decisions

Use this directory for durable, tracked architecture decisions that future maintainers can read from a clean clone.

## Accepted decisions

- [ADR-0001: Keep tracked engineering authority outside internal requirements](0001-tracked-engineering-authority.md)
- [ADR-0002: Require owner approval and allow scoped ephemeral deployment credentials](0002-manual-production-approval-and-ephemeral-credentials.md)
- [ADR-0003: Do not require MFA for the current release stage](0003-mfa-not-current-release-gate.md)

The local `requirements/` tree is intentionally ignored, may contain stale intent, and is not repository authority. Do not commit or routinely edit it. Migrate an accepted rule into tracked documentation only after reconciling it with implementation and tests as required by ADR-0001.

When a change alters a durable architecture or product choice, add or supersede a tracked ADR here. Preserve history and record status, alternatives, consequences, evidence, and unresolved facts; do not invent certainty from internal prose.

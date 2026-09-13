---
last_updated: 2026-09-11
document_type: reference
---

# Engineering documentation

Start here when you need repository context. `AGENTS.md` contains mandatory guardrails; these documents provide the evidence and procedures behind them.

## Current implementation

- [System architecture](architecture/system.md) explains runtime components and data flow.
- [Domain invariants](domain/invariants.md) lists business facts code must preserve.
- [Current product scope](domain/current-product-scope.md) distinguishes implemented, partial, deferred, divergent, and unknown behavior.
- [Repository structure](codebase/STRUCTURE.md) maps directories and runtime entry points.
- [Technology stack](codebase/STACK.md) inventories runtime and development dependencies.
- [External integrations](architecture/integrations.md) defines service and reliability boundaries.
- [Known concerns](codebase/CONCERNS.md) records technical debt and unresolved operational decisions.

## Engineering procedures

- [Engineering standards](engineering/standards.md) defines coding, API, database, frontend, test, and security expectations.
- [Naming and file conventions](engineering/naming-conventions.md) defines mandatory identifiers, units, files, and Admin module names.
- [Testing architecture](engineering/testing.md) maps commands, suites, and known coverage gaps.
- [Documentation governance](engineering/documentation-governance.md) separates public tracked context from private versioned planning material.
- [Environment reference](engineering/environment-reference.md) maps runtime and operator variables.
- [Database migrations](engineering/database-migrations.md) covers generation, validation, production application, verification, and recovery limits.
- [Production deployment](engineering/production-deployment.md) is the Vercel and Turso CLI runbook.
- [CI/CD process](engineering/ci-cd.md) defines commit/PR gates, migration detection, owner approval, deployment, alias verification, and rollback boundaries.
- [Turso token rotation](engineering/turso-token-rotation.md) defines the read-only reminder and owner-approved credential rotation procedure.
- [Proposed backup and restore policy](engineering/backup-restore-policy.md) gives a reviewable Turso naming, retention, restore, and drill baseline.
- [Customer retention release notes](release-notes/customer-retention.md) cover the existing retention backfill and apply procedure.

## Decisions

[Architecture decisions](adr/README.md) records accepted repository authority, production approval/credential ownership, and the current MFA risk decision. Local `requirements/` files are internal, ignored, potentially stale, and not repository authority.

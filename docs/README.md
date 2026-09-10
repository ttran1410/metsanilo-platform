---
last_updated: 2026-09-10
document_type: reference
---

# Engineering documentation

Start here when you need repository context. `AGENTS.md` contains mandatory guardrails; these documents provide the evidence and procedures behind them.

## Current implementation

- [System architecture](architecture/system.md) explains runtime components and data flow.
- [Domain invariants](domain/invariants.md) lists business facts code must preserve.
- [Current product scope](domain/current-product-scope.md) distinguishes implemented, partial, deferred, divergent, and unknown behavior.
- [Repository structure](codebase/STRUCTURE.md) maps directories and runtime entry points.
- [Architecture reference](codebase/ARCHITECTURE.md) traces representative call paths and dependency direction.
- [Technology stack](codebase/STACK.md) inventories runtime and development dependencies.
- [Coding conventions](codebase/CONVENTIONS.md) records patterns evidenced in current source.
- [External integrations](codebase/INTEGRATIONS.md) defines service and reliability boundaries.
- [Testing architecture](codebase/TESTING.md) maps commands, suites, and known coverage gaps.
- [Known concerns](codebase/CONCERNS.md) records technical debt and unresolved operational decisions.

## Engineering procedures

- [Engineering standards](engineering/standards.md) defines coding, API, database, frontend, test, and security expectations.
- [Environment reference](engineering/environment-reference.md) maps runtime and operator variables.
- [Database migrations](engineering/database-migrations.md) covers generation, validation, production application, verification, and recovery limits.
- [Production deployment](engineering/production-deployment.md) is the Vercel and Turso CLI runbook.
- [CI/CD process](engineering/ci-cd.md) defines commit/PR gates, migration detection, owner approval, deployment, alias verification, and rollback boundaries.
- [Proposed backup and restore policy](engineering/backup-restore-policy.md) gives a reviewable Turso naming, retention, restore, and drill baseline.
- [Customer retention release notes](release-notes/customer-retention.md) cover the existing retention backfill and apply procedure.

## Decisions

[Architecture decisions](adr/README.md) records accepted repository authority, production approval/credential ownership, and the current MFA risk decision. Local `requirements/` files are internal, ignored, potentially stale, and not repository authority.

---
last_updated: 2026-08-30
document_type: decision
---

# ADR-0001: Keep requirements internal and track maintainer context in docs

## Status

Accepted on 2026-08-30 by the repository owner.

## Context

The maintainer workspace contains a large `requirements/` tree with product requirements and historical decisions. `.gitignore` intentionally excludes that directory. Some files may be stale, and future agents working from a clean clone cannot read them.

Tracked files previously linked directly to internal requirements. Those links made the repository documentation incomplete and encouraged agents to treat unverified internal prose as current implementation truth.

## Decision drivers

- Internal product documents must remain private and untracked.
- Future agents need enough tracked context to maintain the system safely.
- Historical intent must not override current code/tests without reconciliation.
- Deferred or missing behavior must remain visible without presenting it as shipped.

## Decision

Keep `requirements/` ignored and do not commit it.

Maintain repository-facing engineering context under `docs/`, organized as:

- `docs/architecture/` for current runtime architecture;
- `docs/domain/` for verified product scope and invariants;
- `docs/engineering/` for coding and operational standards;
- `docs/adr/` for durable tracked decisions.

When migrating a rule from internal requirements:

1. Trace the relevant implementation and tests.
2. Classify the rule as implemented, partial, deferred, divergent, or unknown.
3. Copy only the minimum durable rule and rationale needed by maintainers.
4. Cite tracked source/test evidence.
5. Mark unsupported intent as `[TODO]` or a proposed decision.

Do not routinely edit internal requirements during engineering documentation work. Update them only through a separate internal-document review, especially for deferred or unimplemented capabilities whose status changed.

## Consequences

### Positive

- Clean clones contain the instructions agents need.
- Stale internal prose cannot silently become an implementation contract.
- Product gaps and deferred work remain explicit.

### Negative

- Internal and tracked documentation require deliberate reconciliation.
- Some rationale remains unavailable to external/clean-clone maintainers until migrated.

### Risks and mitigations

- Risk: tracked summaries lose nuance. Mitigation: include evidence and keep uncertain policy marked rather than guessed.
- Risk: duplicated rules drift. Mitigation: make `docs/` concise and point to executable code/tests for details.

## Evidence

- `.gitignore`
- `AGENTS.md`
- `docs/README.md`
- `src/domain`
- `tests`

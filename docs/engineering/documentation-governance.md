---
last_updated: 2026-09-11
document_type: reference
---

# Documentation governance

The public repository and the private planning workspace serve different audiences. File extension does not determine confidentiality: a Markdown file committed to this repository is public.

## Public, tracked documentation

Track only maintainer context that is safe to publish and required to build, review, test, or operate the application safely:

- root `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `DESIGN.md`;
- verified architecture, domain invariants, engineering standards, runbooks, and accepted public ADRs under `docs/`;
- nested `AGENTS.md` files for subsystem-specific rules.

`AGENTS.md` is the canonical agent policy. Optional vendor files such as `CLAUDE.md` and `GEMINI.md` are discovery adapters only; when present, they should point to `AGENTS.md`, remain short, and must not duplicate or contradict repository rules. Their presence is not mandatory for repository verification; see [Agent instruction compatibility](agent-compliance-matrix.md).

The repository does not currently use a root `ARCHITECTURE.md`. The canonical architecture authority is [`docs/architecture/system.md`](../architecture/system.md), supported by the focused documents in `docs/architecture/`.

Public docs must not contain credentials, private customer/business data, production exports, unpublished commercial plans, private incident evidence, or assumptions presented as decisions.

## Private local documentation

Keep the complete `requirements/` directory local and ignored. Do not force-add it to the public repository, initialize a nested Git repository in it, or commit its files to another repository. The owner confirmed this storage policy on 2026-09-11.

Recommended structure:

```text
requirements/
  README.md
  current/
    product/
    requirements/
  decisions/
    candidates/YYYY/MM/
    accepted/YYYY/
    superseded/YYYY/
  evidence/
    engineering/YYYY/MM/
    releases/YYYY/MM/
  linkedin/
    evidence/YYYY/
    drafts/YYYY/
    published/YYYY/
  snapshots/YYYY/MM/DD/
  archive/
```

Use ISO-dated immutable snapshots for local revisions and back up the complete directory to an encrypted owner-controlled destination. This provides recovery and chronological versions but not Git-quality diffs, merge history, or tamper-evident commits. Keep a small manifest in each snapshot that records the timestamp, reason, source files, and SHA-256 checksums. The ignored working directory must not be the only copy.

## File naming and decision conflicts

Use ISO dates so files sort chronologically:

```text
YYYY-MM-DD-topic.md
YYYY-MM-DDTHHmm-topic-option-a.md
```

Decision candidates include `status`, `created_at`, `topic`, `option`, `evidence`, and `conflicts_with`. When two proposals conflict, keep both immutable candidate files until the owner decides. Acceptance creates or promotes one accepted decision and records the rejected/superseded candidates; do not silently merge incompatible policy.

Accepted public architecture decisions use the repository ADR sequence and supersede earlier ADRs with a new record rather than rewriting history. Facts copied from private notes must be checked against current code/tests and classified as implemented, partial, deferred, divergent, or unknown.

## Duplicate-document merge rule

Before merging duplicate documents:

1. classify each statement as code-evidenced fact, test-evidenced behavior, owner-confirmed decision, proposal, historical note, or unknown;
2. retain one canonical public location for verified facts and accepted public decisions;
3. preserve conflicting proposals as separate dated private candidates;
4. mark unsupported statements `[TODO]` or `[ASK USER]` instead of inventing a resolution;
5. update inbound links and remove the obsolete duplicate only after the canonical document is complete.

## Security note

Ignoring or deleting a path does not erase prior Git history. If private material was ever committed publicly, audit the history and rotate any exposed credential. A history rewrite is a separate coordinated operation because it invalidates clones and references. Pattern scanning reduces risk but cannot prove that prose contains no personal or confidential information.

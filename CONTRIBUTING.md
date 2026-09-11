# Contributing to Metsänilo

This project accepts human- and agent-assisted changes. `AGENTS.md` is the mandatory engineering entry point; this file describes the human workflow around it.

## Branch and scope

1. Start from an up-to-date `main` and work on a task branch.
2. Keep one coherent concern per branch. Separate structural renames from behavioral changes when practical.
3. Do not include local databases, environment files, generated output, credentials, customer data, or the ignored `requirements/` workspace.
4. Explain why a change belongs in the selected layer and identify the affected call path.

## Before review

Run the verification level appropriate to the change:

```bash
npm run verify:quick
npm run verify
npm run verify:release -- main
```

- `verify:quick` runs typecheck, lint, and tests.
- `verify` also builds the production bundle.
- `verify:release` additionally compares the branch with a base ref and validates the full migration chain on a disposable local database when database files changed.

Install the optional repository pre-push hook with:

```bash
git config core.hooksPath .githooks
```

The hook runs `verify:quick`. It is a convenience, not proof that the full release gate passed.

## Review description

Include:

- problem and root cause;
- implementation and affected modules;
- behavior/API/schema/security impact;
- tests and commands run;
- migration and deployment classification;
- documentation changed;
- skipped checks, unverified assumptions, and follow-up work.

Review the final diff for unrelated files before asking for approval. Bug fixes normally include a regression test. Architecture, domain rules, operational procedures, and accepted decisions must update the corresponding public engineering Markdown.

## Merge and release

`main` is the releasable branch. A local pass does not authorize production changes. Database migration and Vercel deployment require the owner-approved process in `docs/engineering/ci-cd.md`, `docs/engineering/database-migrations.md`, and `docs/engineering/production-deployment.md`.

Internal product notes and publishing material follow `docs/engineering/documentation-governance.md`; keep them ignored and protect dated snapshots with encrypted backup rather than Git commits.

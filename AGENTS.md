# Metsänilo repository instructions

This is a single-shop seasonal berry commerce and fulfillment application. It has a Finnish/English public storefront and an authenticated operations/admin portal. These instructions are for coding agents acting as maintainers.

## Before changing code

1. Inspect `git status --short --branch`. Do not edit on `main`; use a task branch.
2. Read the relevant source path, nearby tests, and the authoritative document linked from `docs/` before forming a solution.
3. Trace the complete affected call path: route/UI → parser/adapter → domain action → database transaction → response/read model. Search for an existing pattern before adding an abstraction.
4. State assumptions that are not proven by source or tests. Do not silently choose product policy.
5. Keep the change focused. Prefer a root-cause fix in the owning layer over a route-level workaround.

## Source of truth and boundaries

- Current architecture: [`docs/architecture/system.md`](docs/architecture/system.md).
- Domain invariants: [`docs/domain/invariants.md`](docs/domain/invariants.md) and executable functions in `src/domain`.
- Engineering, API, database, security, and operations rules: [`docs/engineering/`](docs/engineering/); start at [`docs/README.md`](docs/README.md).
- Database migration runbook: [`docs/engineering/database-migrations.md`](docs/engineering/database-migrations.md).
- Vercel/Turso production runbook: [`docs/engineering/production-deployment.md`](docs/engineering/production-deployment.md).
- Historical/approved decisions: [`docs/adr/`](docs/adr/). A local `requirements/` directory may exist, but it is ignored, internal, and potentially stale. Do not commit or routinely edit it, cite it as repository authority, or make tracked guidance depend on it. Reconcile accepted rules with code/tests before migrating them into `docs/`.
- Visual design: [`DESIGN.md`](DESIGN.md). It is a target design reference and does not prove current UI conformance.

The dependency direction is: `src/app` composes `src/domain` and `src/lib`; `src/domain` owns business behavior and uses typed database access; `src/db` owns schema/client; `src/lib` owns cross-cutting runtime helpers. Do not put business rules in pages, route handlers, or UI controllers. Do not make domain code depend on React components.

## Non-negotiable safety rules

- Scope every database query and mutation by `env().SHOP_ID` or validated shop context. Shop isolation is a security boundary even though deployment is currently single-shop.
- Admin UI visibility is not authorization. Admin API routes must enforce permission at the route boundary; `proxy` is only an early session gate.
- Preserve both Better Auth and signed `metsanilo_session` authentication paths until an explicitly approved migration removes one.
- Keep money as integer cents and volume as integer millilitres. Preserve order idempotency, transactions, capacity reservations, expected-version checks, legal lifecycle transitions, and audit writes.
- Use `DomainError` and `src/app/api/response.ts` for API failures. Preserve stable error codes, field errors, and correlation IDs.
- Use explicit `[locale]` routing and `src/lib/i18n`/locale formatters. Do not branch ad hoc on language or change persisted status codes for display text.
- Schema changes require a new migration in `drizzle/`; never rewrite an applied migration or edit generated/build output.
- Run `npm run db:generate` only after changing `src/db/schema.ts`. Inspect generated SQL and test the complete migration chain on a disposable database.
- Do not log secrets, passwords, session tokens, full payment details, or unnecessary customer PII.
- Do not run a production migration, seed, release, deploy, promote, rollback, database copy, token creation, or database destroy command without explicit authorization and verified targets.
- The repository owner owns Vercel/Turso credentials and production approval. An agent may create or use a short-lived least-privilege credential only after approval for the exact release, must not expose it, and must revoke/expire it afterward. MFA is not a current release gate; follow ADR-0002 and ADR-0003 rather than inventing a stronger or weaker policy.

## Change and verification requirements

- Bug fixes require a regression test that fails before the fix when practical. Behavioral changes require tests for success, validation, authorization, concurrency, and relevant failure paths.
- Reuse existing domain actions and adapters. Do not update tables directly from a page or route when a domain transaction exists.
- Run focused tests while iterating, then `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` as appropriate to the risk. Database/deployment commands must use disposable/local or explicitly authorized environments.
- Review the final diff yourself for scope, security, migration safety, localization, accessibility, error contracts, and generated files.
- Update architecture/domain/engineering/ADR documentation when behavior, boundaries, operational procedure, or an invariant changes.
- Report what was not verified, including unavailable services, skipped commands, and unresolved `[TODO]`/`[ASK USER]` items.

## Commands and environment

Use `npm ci` for a clean install. Local configuration is described by `.env.example`; `src/lib/env.ts` validates part of the runtime configuration. The default database is `file:local.db`. Production requires a remote Turso URL, `TURSO_AUTH_TOKEN`, and secure auth secrets; never point tests at production.

The `db:*` scripts do not automatically load `.env.local`. `db:migrate:production` loads `.env.production.local` but does not force production validation. `db:release` also runs the seed and is not a routine deploy command. Follow the [CI/CD process](docs/engineering/ci-cd.md), migration runbook, and deployment runbook instead of relying on script names. The canonical production alias is `https://metsanilo.vercel.app/`; a deployment-specific Vercel URL is not a substitute for alias verification.

## Local subsystem rules

- [`src/domain/AGENTS.md`](src/domain/AGENTS.md): business rules, transactions, and invariants.
- [`src/app/api/AGENTS.md`](src/app/api/AGENTS.md): API boundaries, auth, parsing, and response contracts.
- [`src/db/AGENTS.md`](src/db/AGENTS.md): schema, migrations, query scope, and data safety.
- [`scripts/AGENTS.md`](scripts/AGENTS.md): database/release scripts and production operation safety.

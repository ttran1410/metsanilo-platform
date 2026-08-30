---
last_updated: 2026-08-30
document_type: reference
---

# Engineering standards

Use these standards for implementation and review. Follow the linked runbooks for state-changing database and deployment procedures.

## API and error contracts

Use `DomainError` for expected domain failures and `fromZodError` for schema failures. Route handlers should return `success(data, status)` or `failure(error, request)` from `src/app/api/response.ts`; preserve error code, HTTP status, field errors, and correlation ID. Do not leak stack traces or secrets to clients.

Admin routes must authenticate and enforce the required permission on the server. Parse JSON/query/path inputs at the boundary. Keep route handlers thin and put reusable behavior in `src/domain`.

## Database and migrations

`src/db/schema.ts` is the Drizzle schema source of truth; `drizzle/` contains applied migrations. Add a new migration for schema changes and review generated SQL. Keep all queries shop-scoped. Use transactions for coupled effects and conditional updates for optimistic concurrency. Tests must create disposable `file:` databases rather than using shared or production data.

Follow [Run database migrations safely](database-migrations.md) for generation, full-chain validation, production preflight, backup, application, verification, and recovery. Use the [CI/CD process](ci-cd.md) to determine whether a merged release needs that migration stage. A Vercel application rollback never reverses a Turso migration.

## Frontend and localization

Follow existing App Router server/client boundaries and feature workspace patterns. Use explicit `fi`/`en` routing, shared formatters, accessible native controls, and the design contract in `DESIGN.md`. Preserve URL state contracts and stable persisted status codes; translate labels at presentation time.

## Testing

Vitest runs in Node with file parallelism disabled (`vitest.config.ts`). Tests cover domain behavior, API contracts, URL state, admin permission contracts, and workspace decomposition. Add focused regression coverage first, then run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` as appropriate. [TODO] Confirm whether Storybook stories are required in CI; scripts exist but no CI workflow was found.

## Security and operations

Environment parsing is centralized in `src/lib/env.ts`; `.env.example` is the checked-in variable inventory. Production preflight rejects local databases and requires remote Turso credentials plus `ADMIN_SESSION_SECRET`, but it does not validate Better Auth or Blob credentials. Never commit `.env*`, local databases, build output, credentials, or generated runtime artifacts. Media operations use Vercel Blob and must remain permission-protected. Logging currently uses console records for API failures and admin timing; [TODO] no centralized log/alert retention or redaction policy was found.

Follow [Deploy to production with Vercel and Turso CLI](production-deployment.md) and the [proposed Turso backup/restore policy](backup-restore-policy.md). Production state changes require explicit authorization and independent verification of account, project, database, environment, and rollback compatibility.

Evidence: `src/app/api/response.ts`, `src/app/api/admin/module.ts`, `src/domain/errors.ts`, `src/db/client.ts`, `src/db/schema.ts`, `drizzle/`, `vitest.config.ts`, `src/lib/env.ts`, `.env.example`, `scripts/preflight.ts`, `scripts/migrate.ts`, `scripts/release.ts`, `scripts/seed.ts`, `package.json`.

# Database subsystem rules

- Keep `src/db/schema.ts` authoritative for Drizzle schema definitions and keep applied migration history in `drizzle/` immutable.
- Add a new migration for schema changes; inspect generated SQL and test migration application on a disposable database.
- Run `db:generate` only after schema changes. For table rebuilds or backfills, test existing-data preservation, not only fresh schema creation.
- Every query and mutation must include the configured shop scope unless the operation is explicitly global infrastructure (for example isolated Better Auth tables); document exceptions.
- Use transactions for coupled effects such as order/capacity/payment/audit changes and conditional updates for optimistic concurrency.
- Do not expose database rows directly when a domain read model or response contract is the established boundary.
- Production migrations are forward-only. Verify Turso/Vercel targets, force production preflight, create an approved backup for destructive changes, and remember that Vercel rollback does not revert schema.
- Never use `db:release` as routine migration verification: it runs seed and can reset bootstrap-admin credentials when existing data is allowed.

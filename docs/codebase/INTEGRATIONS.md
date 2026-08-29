# External Integrations

## Integration Inventory

| System | Type | Purpose | Auth/config | Criticality | Evidence |
|---|---|---|---|---|---|
| libSQL/Turso | Database | Shop, orders, customers, auth, audit data | env configuration | High | `src/db/client.ts`, `.env.example` |
| Better Auth | Authentication | Admin sign-in/session/auth account handling | Better Auth secret and URL | High | `src/lib/auth.ts`, `src/app/api/auth` |
| Vercel Blob | Object storage | Product/CMS media | Blob token/config | Medium | `src/domain/admin-media-actions.ts` |
| Next.js RSC | Internal transport | Server component page payloads | Framework runtime | Medium | `src/app/admin`, Next config |

## Data Stores

- Primary store: libSQL/SQLite-compatible database accessed through Drizzle.
- Local test databases are disposable `file:` databases created by tests. [TODO] Document production database observability.

## Secrets

- Configuration comes from environment variables; secrets are not committed.
- Better Auth warns when `BETTER_AUTH_SECRET` is short or low entropy.
- [TODO] Define rotation procedure and ownership.

## Reliability and Observability

- API failures include correlation IDs through `src/app/api/response.ts`.
- Domain/database transactions are used for critical order and admin mutations.
- RSC page requests are not JSON and should not be interpreted as API failures.
- CSV exports intentionally return file content rather than JSON.

## Evidence

- `src/db/client.ts`
- `src/lib/auth.ts`
- `src/app/api/response.ts`
- `src/domain/admin-media-actions.ts`
- `.env.example`

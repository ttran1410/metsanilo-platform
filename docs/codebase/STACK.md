# Technology Stack

## Runtime Summary

| Area | Value | Evidence |
|---|---|---|
| Primary language | TypeScript 5.9.3 | `package.json` |
| Runtime | Node.js 20.9+ | `README.md` |
| Framework | Next.js 16.3.0, React 19.2.8 | `package.json` |
| Package manager | npm | `package-lock.json`, `package.json` |
| ORM/database | Drizzle ORM 0.45.2 with libSQL/Turso | `package.json`, `src/db/client.ts` |

## Production Dependencies

| Dependency | Role | Evidence |
|---|---|---|
| `next` | App Router server/client rendering and route handlers | `package.json`, `src/app` |
| `better-auth` | Authentication | `src/lib/auth.ts`, `src/app/api/auth` |
| `drizzle-orm` | Database queries and transactions | `src/db`, `src/domain` |
| `@libsql/client` | SQLite-compatible database driver | `src/db/client.ts` |
| `@vercel/blob` | Media storage | `src/domain/admin-media-actions.ts` |
| `zod` | Runtime input validation | `src/app/api/admin`, `src/domain` |

## Development Toolchain

- TypeScript compiler: `npm run typecheck`
- ESLint with Next config: `npm run lint`, `eslint.config.mjs`
- Vitest: `npm test`, `vitest.config.ts`
- Next production build: `npm run build`
- Storybook: `.storybook`, `package.json`

## Environment

Configuration is read through `src/lib/env.ts` and `.env.example`. Important variables include database URL, `SHOP_ID`, Better Auth settings, and admin session settings. Production secret strength warning is emitted when `BETTER_AUTH_SECRET` is short or low entropy. [TODO] Document deployment secret rotation ownership.

## Evidence

- `package.json`
- `src/db/client.ts`
- `src/lib/env.ts`
- `README.md`

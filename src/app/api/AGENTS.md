# API subsystem rules

- Route handlers are adapters: parse, authenticate/authorize, call domain, serialize. Keep policy and database mutations out of handlers.
- Admin endpoints must enforce permission server-side through the established admin module. `src/proxy.ts` is not sufficient authorization.
- Use `success`/`failure` from `src/app/api/response.ts`; preserve correlation IDs and stable error semantics.
- Validate JSON, query, and path parameters at the boundary. Preserve `expectedVersion` and idempotency inputs for concurrent/duplicate-sensitive operations.
- Add or update API contract tests for behavior, authorization failures, malformed input, domain conflicts, and response shape.

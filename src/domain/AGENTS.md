# Domain subsystem rules

- Treat `src/domain` as the owner of business policy, invariants, transactions, normalization, and read models.
- Validate shop and actor context before reads/writes. Preserve integer cents/ml, timezone-aware business dates, order capacity, idempotency, expected-version checks, legal transitions, payment/refund constraints, and audit effects.
- Reuse existing domain functions and transaction patterns. Do not move business logic into route handlers, pages, or client controllers.
- When changing behavior, inspect and update nearest focused tests plus an API contract test when the boundary changes.
- Use `DomainError` with an existing stable code or explicitly document a new contract. Never return ad hoc error shapes.

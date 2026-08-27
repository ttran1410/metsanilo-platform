# ADR 0019: Order snapshot PII retention

## Status

Accepted — deferred implementation

## Decision

Customer anonymization does not delete orders or alter financial totals, volume, status, fulfillment dates, or audit records. Order snapshots may contain copied customer contact/address data and are therefore governed separately from the customer profile.

Until legal/accounting retention requirements are confirmed, order snapshot PII is retained with the order and is not automatically anonymized by the customer retention CLI. The CLI may anonymize the customer profile only when all eligibility rules pass.

## Future implementation

Once the required accounting/legal period is documented, add a separate, auditable snapshot-redaction job. It must preserve the order ledger and replace only approved PII fields, with an explicit dry-run and batch limit.

## Consequences

The current release avoids destructive assumptions about historical transaction records. Customer identity retention and order-record retention remain independently reviewable and testable.

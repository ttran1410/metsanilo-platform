# ADR 0018: Customer retention and operator contact confirmation

## Status

Accepted

## Decision

Customer personal data is eligible for anonymization 24 months after the latest fulfilled or cancelled order, provided there are no open orders, active legal/accounting holds, or unexpired operator contact confirmations.

An operator may confirm contact with a customer through WhatsApp, SMS, phone, or another channel in Admin Portal. A confirmation is valid for 12 months, is not automatically renewed, and is recorded with channel, actor, timestamp, expiry, and an optional note. This is a retention confirmation, not marketing consent.

Administrators receive retention management and anonymization permissions by default. Other roles require explicit `customers.retention.manage` and `customers.anonymize` grants respectively.

Existing customers receive a one-time migration confirmation valid for 12 months, marked with source `MIGRATION`. New orders do not create a confirmation; they affect retention through their eventual fulfillment or cancellation date.

## Operations

The first release uses an operator CLI with mandatory `--dry-run` or `--apply`, batch limits, idempotency, and audit reporting. Automated daily Vercel Cron execution is deferred until the CLI and hold workflow are proven.

Orders, financial totals, and audit records are retained. Customer identity fields are anonymized independently; order snapshot PII requires a separate legal/accounting decision.

## Consequences

Retention decisions are explainable and reversible before anonymization. Operators must actively renew confirmations, and production automation cannot silently bypass legal holds or open-order exclusions.

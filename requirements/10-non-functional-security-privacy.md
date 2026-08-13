# 10 — Non-functional, Security and Privacy Requirements

> **v0.0.1 scope override — ADR-0005 applies.** Apply these controls to the single shop and four pilot roles. Google/Meta provider controls, tenant isolation, analytics consent, channel webhooks, video processing, advanced exports, and automated notification infrastructure are deferred. MFA, server-side authorization, auditability, safe image uploads, Finnish/English localization, accessibility, and capacity/order integrity remain in scope.

Numeric targets are MVP baselines and should be validated against hosting choices and expected traffic.

## 1. Performance and capacity

- **NFR-PERF-001:** Public pages should achieve p75 Largest Contentful Paint ≤ 2.5 s on representative Finnish 4G/mobile devices under normal load.
- **NFR-PERF-002:** Public read API p95 server response ≤ 500 ms and normal admin read p95 ≤ 1 s, excluding third-party outages.
- **NFR-PERF-003:** Order submit p95 server processing ≤ 2 s under expected peak, excluding user network latency.
- **NFR-PERF-004:** Lists use pagination and bounded queries; dashboard computations must not scan unbounded history synchronously.
- **NFR-PERF-005:** Expected traffic and capacity assumptions must be load-tested before launch, including a burst against the final remaining package.
- **NFR-PERF-006:** An on-screen weekly report for one year of expected MVP data should return within 3 seconds p95; larger CSV/PDF exports may run asynchronously with visible status.

## 2. Availability, reliability, and recovery

- **NFR-REL-001:** Monthly availability target is 99.5% for public ordering during active season, excluding announced maintenance.
- **NFR-REL-002:** Order/capacity transactions are strongly consistent and durable after a success receipt.
- **NFR-REL-003:** Scheduler and notification work is durable, idempotent, retryable, and observable.
- **NFR-REL-004:** Database backups are encrypted and restore-tested. Initial targets: RPO ≤ 24 hours, RTO ≤ 8 hours; tighter targets may be adopted before launch.
- **NFR-REL-005:** A documented manual continuity procedure shall exist for taking orders when the platform is unavailable and reconciling them later.
- **NFR-REL-006:** Financial aggregates shall reconcile to source transactions; formula/version changes require a documented migration or comparative restatement strategy.
- **NFR-REL-007:** Invoice and report PDF generation shall be deterministic enough to reproduce content from the stored snapshot/template version and shall fail without issuing a partially valid document.

## 3. Security

- **NFR-SEC-001:** All traffic uses modern TLS; secrets and personal data are encrypted at rest through platform/database controls.
- **NFR-SEC-002:** Portal authentication uses a secure managed identity-provider policy and mandatory MFA for every human Platform Admin, Manager, Staff, and Content Editor account. Service identities are non-interactive and use separately managed credentials.
- **NFR-SEC-003:** Sessions use secure, HttpOnly, SameSite cookies or equivalently protected tokens; CSRF, XSS, injection, broken access control, and file-upload threats are mitigated.
- **NFR-SEC-004:** Authorization is enforced server-side for every protected object/action and tested for horizontal/vertical privilege escalation.
- **NFR-SEC-005:** Public forms have layered bot/rate-limit protection without inaccessible puzzles as the only option.
- **NFR-SEC-006:** Uploaded media is type/size validated, stored outside executable application paths, and scanned where supported.
- **NFR-SEC-007:** Logs, analytics, URLs, and error messages do not expose secrets or unnecessary personal information. Google Maps web-service credentials remain server-side, restricted to required APIs and deployment sources/IPs (or stronger supported authentication), with separate environment credentials, quotas, and abuse monitoring.
- **NFR-SEC-008:** Dependencies, containers, and infrastructure receive vulnerability scanning and patching; critical exploitable findings block release.
- **NFR-SEC-009:** Platform Console and shop-portal audit logs are tamper-resistant to normal application users.
- **NFR-SEC-010:** Staff earnings, supplier payment details, receipts, financial exports, and invoices require object-level authorization; download links are short-lived and non-guessable.

## 4. Privacy and data protection

- **NFR-PRV-001:** Data collection follows purpose limitation and minimization; forms do not request information unnecessary for the stated process.
- **NFR-PRV-002:** Privacy notices exist in Finnish and English and describe controller, purposes, lawful bases, retention, recipients/processors, transfers, rights, and contact route.
- **NFR-PRV-003:** Marketing consent is granular, demonstrable, optional, and unchecked; withdrawal is recorded and honored.
- **NFR-PRV-004:** The platform supports access, correction, objection, restriction, portability where applicable, and erasure/anonymization workflows with identity verification.
- **NFR-PRV-005:** Processor agreements, hosting region/transfers, email provider, Google address/routing services, analytics, media storage, and backups must be assessed before production. Current Google Maps Platform EEA terms, attribution/display, retention/caching, data-processing/transfer, billing, and minimization requirements must be approved before customer addresses are sent in production.
- **NFR-PRV-006:** Retention schedules for orders/accounting evidence, customers, contact messages, picker applications, reviews, consent, notifications, and audit logs require documented owner/legal approval before launch.
- **NFR-PRV-007:** Production data is not copied into development/test without approved anonymization.
- **NFR-PRV-008:** Financial reports minimize personal data; staff-level earnings are visible only to that staff member, Manager, Platform Admin in selected-shop context, or a user explicitly granted earnings-read scope. Manager/Platform Admin financial workflow authority does not weaken this read boundary for other roles. Aggregate reports should omit unnecessary names.

This document is a product specification, not legal advice. Finnish/EU legal and tax retention details should be reviewed by qualified counsel/accounting professionals before launch.

## 5. Accessibility and usability

- **NFR-ACC-001:** Public and admin critical flows target WCAG 2.2 AA.
- **NFR-ACC-002:** All functions are keyboard operable; focus is visible/logical; dialogs manage focus correctly.
- **NFR-ACC-003:** Forms have programmatic labels, instructions, error association/summary, non-color-only status, and screen-reader-accessible star/radio controls.
- **NFR-ACC-004:** Text/background contrast, target sizes, reflow at 320 CSS px, zoom, reduced motion, and language attributes are verified.
- **NFR-ACC-005:** Before public launch, the operating company shall record whether the service is legally in scope of Finland's post-28-June-2025 e-commerce accessibility requirements, including evidence for any microenterprise exclusion. If in scope, required accessibility information, feedback/contact, monitoring, and remediation processes shall be implemented and approved. WCAG 2.2 AA remains the product target regardless of legal exclusion.
- **NFR-USA-001:** Customer order form is usable on mobile without account creation and communicates pending confirmation clearly.

## 6. Localization and compatibility

- **NFR-L10N-001:** All public and admin UI strings are externalized for Finnish/English; no untranslated key appears publicly.
- **NFR-L10N-002:** EUR, dates, times, decimal separators, phone, and address presentation follow locale while stored values remain canonical.
- **NFR-L10N-003:** Support current and previous major versions of Safari, Chrome, Firefox, and Edge; include iOS Safari and Android Chrome.
- **NFR-L10N-004:** Invoice/report PDFs embed fonts supporting Finnish and customer-name Unicode, render EUR/date/decimal values consistently, and meet applicable document accessibility requirements where feasible.

## 7. Observability and maintainability

- **NFR-OBS-001:** Structured logs, metrics, traces/correlation IDs, scheduler status, email delivery results, error-rate and latency alerts are available without exposing unnecessary PII.
- **NFR-OBS-002:** Alerts cover order-submit failures, capacity invariant violations, scheduler delay/failure, notification backlog, authentication anomalies, database/storage health, and Google address/routes latency, errors, quota/budget pressure, and manual-fallback rate. Metrics separate intentional `PROVIDER_DISABLED` fallback from provider faults so an off switch does not create a false outage alert.
- **NFR-MNT-001:** Domain rules are covered by automated tests and versioned migrations/contracts.
- **NFR-MNT-002:** Configuration changes and deployments support rollback; runbooks cover common operational incidents.
- **NFR-MNT-003:** API and data structures retain extension points for future payment, customer account, customer messaging, picker operations, and delivery providers without premature implementation.
- **NFR-MNT-004:** Financial formulas and invoice/report templates are versioned and covered by golden/reconciliation tests.

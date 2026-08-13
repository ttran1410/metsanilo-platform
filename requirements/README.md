# METSÄNILO Product Documentation

Version: 2.2
Status: v0.0.1 two-day pilot baseline (future requirements retained below)
Language: English  
Market: Pori/Satakunta, Finland  
Currency: EUR  
Business timezone: `Europe/Helsinki`

## Purpose

This documentation defines the MVP for METSÄNILO, a local seasonal-produce commerce and operations platform. The public experience must remain fast and simple, while the administration portal supports products, capacity, orders, customers, delivery, content, reviews, picker applications, messages, users, permissions, settings, notifications, and operational reporting.

The documents are intended to be usable by Product Owners, Software Engineers, UX/UI designers, and Quality Engineers without relying on the original conversation. ADR-0005 is the release-scoped authority for v0.0.1; older broad-platform requirements remain future roadmap context.

## v0.0.1 scope at a glance

The pilot is one shop operated by `ADMIN` (owner), `MANAGER`, `STAFF`, and `CONTENT_CREATOR`. It includes Finnish-default/English-switchable public content, products and bounded capacity/sold-out controls, pickup, delivery always shown as “Delivery to be agreed,” manually entered delivery fees, orders, basic payment records, invoice PDF download, picking records in either litres or kilograms with unit-specific buy prices, record-only external pickers, and feature-level per-user permissions. Customer orders/capacity remain litres-only. It excludes shop organisation, Platform Admin, Facebook/WhatsApp, Google route services, postal-zone classification, supplier/expense/quality/accounting/reporting modules, video media, and marketing automation.

## Document index

| Document | Primary audience | Contents |
|---|---|---|
| [01 — Business Overview and MVP Scope](01-business-overview-and-mvp-scope.md) | PO, stakeholders | Vision, actors, value, scope, assumptions, success measures |
| [02 — Functional Requirements](02-functional-requirements.md) | PO, Engineering, QE | Testable requirements with stable IDs |
| [03 — Business Rules and Validation](03-business-rules-and-validation.md) | PO, Engineering, QE | Order, capacity, delivery, privacy, state, and timing rules |
| [04 — Business and User Flows](04-business-and-user-flows.md) | PO, UX, Engineering, QE | Customer, admin, picker, contact, review, and CMS flows |
| [05 — Order Lifecycle and Automation](05-order-lifecycle-and-automation.md) | Operations, Engineering, QE | State machine, capacity effects, scheduler behavior, exceptions |
| [06 — Form and Field Specifications](06-form-and-field-specifications.md) | UX, Engineering, QE | Layout, fields, conditional behavior, validation, messages |
| [07 — Data Model](07-data-model.md) | Engineering, data, QE | Logical entities, relationships, snapshots, constraints, audit |
| [08 — Technical Architecture and API](08-technical-architecture-and-api.md) | Engineering, architecture, QE | Technology-neutral components, API boundaries, concurrency |
| [09 — Admin Portal, Roles and Permissions](09-admin-portal-roles-and-permissions.md) | PO, Operations, Engineering, QE | Modules, dashboard, RBAC, permissions |
| [10 — Non-functional, Security and Privacy Requirements](10-non-functional-security-privacy.md) | Engineering, security, QE | Performance, reliability, accessibility, GDPR, security |
| [11 — QA Acceptance and Test Strategy](11-qa-acceptance-and-test-strategy.md) | QE, PO, Engineering | Acceptance criteria, risk coverage, test data and release gates |
| [12 — Traceability Matrix](12-traceability-matrix.md) | PO, Engineering, QE | Requirement-to-rule-to-test mapping |
| [13 — Recommended Technology Stack](13-recommended-technology-stack.md) | Engineering | Optional implementation recommendation, not a requirement |
| [14 — Glossary and Open Decisions](14-glossary-and-open-decisions.md) | Everyone | Canonical terms, resolved decisions, implementation-time choices |
| [15 — Reporting, Finance, Staff Earnings and Invoices](15-reporting-finance-staff-earnings-invoices.md) | PO, Operations, Finance, Engineering, QE | Financial formulas, expense/supplier/picking records, reports, exports, invoice PDF |
| [16 — Multi-tenant Platform and Shop Management](16-multi-tenant-platform-and-shop-management.md) | Product, architecture, Engineering, security, QE | Tenant boundary, platform/shop roles, provisioning, isolation, future subscriptions |
| [17 — Channels, Shared Inbox and Marketing Integrations](17-channels-shared-inbox-marketing-integrations.md) | Product, Marketing, Operations, Engineering, privacy, QE | Facebook/WhatsApp connectors, inbox, content publishing, broadcasts, segments, consent |
| [18 — Architectural Review and Requirements Synthesis](18-architectural-review-and-requirements-synthesis.md) | Everyone | Corrected consolidated MVP summary, architecture boundaries, offline decision, test strategy, open decisions |
| [19 — Development Plan and Progress Tracker](19-development-plan-and-progress.md) | Product, Engineering, UX, QE, Operations | Approved 12-phase delivery plan, Finnish-market UI/UX direction, decision gates, phase status, and progress log |
| [20 — Phase and Release Traceability](20-phase-and-release-traceability.md) | Product, Engineering, QE | Exact assignment of every requirement, rule, NFR, and acceptance scenario to one phase and release gate |
| [Decision Records](decisions/README.md) | Everyone | Approved cross-document product and architecture decisions |

## How to use this set

1. Treat requirements identified by `FR-*`, `BR-*`, and `NFR-*` as the MVP baseline.
2. Use [12 — Traceability Matrix](12-traceability-matrix.md) for capability mapping and [20 — Phase and Release Traceability](20-phase-and-release-traceability.md) for exact delivery/release ownership.
3. If prose conflicts, the more specific business rule wins over a general requirement. A later approved version supersedes this baseline.
4. Record changes through decision records and update affected IDs rather than silently changing behavior.
5. The technology stack document is advisory. The architecture and behavior requirements are technology-neutral.

## Requirement ID conventions

| Prefix | Meaning |
|---|---|
| `FR-PUB` | Public website |
| `FR-ORD` | Orders |
| `FR-CUS` | Customers |
| `FR-PRD` | Products and packages |
| `FR-AVL` | Availability/capacity |
| `FR-DLV` | Pickup and delivery |
| `FR-CMS` | Content management |
| `FR-REV` | Reviews |
| `FR-PIC` | Picker applications |
| `FR-MSG` | Contact/messages |
| `FR-IAM` | Users, roles, permissions |
| `FR-NTF` | Notifications and reminders |
| `FR-DSH` | Dashboard/reporting |
| `FR-SET` | Settings |
| `FR-RPT` | Reporting and exports |
| `FR-FIN` | Expenses, weekly finance, and staff earnings |
| `FR-SUP` | Suppliers and external berry purchases |
| `FR-INV` | Invoice records and PDF generation |
| `FR-TEN` | Tenants/shops and platform administration |
| `FR-MED` | Product media gallery |
| `FR-SRC` | Configurable order source/attribution |
| `FR-QLT` | External-purchase quality grades and rates |
| `FR-ANA` | Funnel and form-abandonment analytics |
| `FR-CHN` | Channel connections, publishing, messaging, and shared inbox |
| `BR-*` | Business rule |
| `NFR-*` | Non-functional requirement |
| `AC-*` | Acceptance scenario |

## Product principles

- No customer account is required in the MVP.
- A customer should be able to understand what is available and submit an order quickly on a mobile device.
- Orders are reservations requiring manual confirmation, not automatically accepted sales.
- The platform must never oversell known capacity.
- Operational truth must not be fabricated by timers: `READY` requires a human confirmation.
- Configuration and extension points are preferred over hard-coded berry-specific behavior.
- Every sensitive or operationally important admin action must be attributable and auditable.
- Management reports must distinguish revenue, result before staff picking cost, and estimated profit after staff picking cost; they are not a substitute for statutory accounting.
- v0.0.1 is deliberately single-shop. Object-level authorization, auditability, and data integrity remain security boundaries even without a tenant switcher.
- Facebook/WhatsApp connectors and Google route services are future integrations and must not be represented as available in the pilot.

## Canonical role terminology

- `ADMIN`: shop owner with all shop permissions.
- `MANAGER`: shop employee with operational authority and permission assignment to Staff/Content Creators.
- `STAFF`: shop employee with feature-level permissions, including order/payment/invoice and picking work when assigned.
- `CONTENT_CREATOR`: shop content/product editor with assigned permissions.
- External picker: record-only person, not a portal account.

# ADR-0003 — Owner Authority and Sold-out Override

Status: Accepted  
Date: 2026-08-13  
Decision owners: Product and Business  
Supersedes: ADR-0001 decision 1, ADR-0002 financial-approval decision, and earlier Platform Admin/Manager permission limitations

## Context

Manager represents the shop owner and must not be prevented from performing a shop-scoped action. Platform Admin (“Admin” in user terminology) must combine all Manager capabilities with platform shop-management capabilities. Operations also needs a way to stop taking orders for a product/date while showing only “Sold out” publicly, without corrupting financial or fulfillment reporting.

## Decisions

### 1. Manager and Platform Admin authority

- Manager has every application permission for assigned shops, including users/roles, products, capacity, orders, customers, content, finance, reports, integrations, settings, approval, payment, and audit access.
- Manager may create, submit, approve, reject, correct, and mark paid the same financial record. No self-approval guard applies to Manager.
- Platform Admin inherits every Manager action when operating in an explicitly selected shop and additionally manages shops, platform grants, entitlements, providers, and platform security.
- Platform Admin shop actions retain visible shop context and audit attribution; explicit context is a tenant-safety mechanism, not a permission reduction.
- Staff and Content Editor remain limited by their role/permissions.
- “No permission prevention” does not bypass tenant isolation, required evidence, valid state transitions, capacity consistency, immutable history, or legal/security controls. These are data/domain invariants, not role restrictions.

### 2. Daily manual sold-out override

- Platform Admin, Manager, and Staff may set or clear `manual_sold_out` for an in-window product business date.
- The override prevents new public and live manual orders for that product/date but does not cancel, change, or fabricate existing orders/reservations.
- It is distinct from the ordinary `accepts_orders = false` scheduling closure: manual sold-out deliberately presents “Sold out” while the internal configured/reserved/remaining values stay factual.
- An internal reason, actor, and timestamp are audited. The reason is never exposed publicly.
- Clearing the override restores the state derived from product window, acceptance settings, cutoff, and actual remaining capacity.

### 3. Public availability presentation

- Effective public state is `SOLD_OUT` when `manual_sold_out = true` or actual remaining capacity is zero.
- Sold-out product/date views display `Loppuunmyyty` in Finnish or `Sold out` in English from i18n resources, disable ordering for that date, and do not display a numeric remaining amount.
- When ordering is otherwise open and remaining capacity is positive, the customer sees the exact remaining litres.
- A manual sold-out override is intentionally indistinguishable from natural sell-out on the customer site. Internally, reports and audit distinguish the cause.

### 4. Truthful reporting

- Manual sold-out state never creates an order, capacity movement, fulfilled litre, revenue, refund, expense, purchase, Picking Entry, or delivery fact.
- Sales, finance, expense, and fulfillment reports continue to derive only from authoritative transactions and status history.
- Internal availability/operations reporting may show configured capacity, reserved/remaining litres, manual-sold-out periods, actor/reason, and natural versus manual sold-out cause as separate facts.

### 5. Capacity administration versus public disclosure

- Removing the shop-configurable public disclosure mode does not restrict internal capacity administration.
- Platform Admin, Manager, and Staff may edit capacity for the current business date, including after cutoff, and for future dates inside the product window.
- Capacity cannot be saved below reserved litres. A capacity edit does not bypass cutoff, change the accepts-orders flag, or clear manual sold-out.
- Historical dates remain immutable availability history; any later business correction belongs in an audited adjustment workflow rather than rewriting the original row.

## Consequences

- Earlier no-self-approval requirements and tests are replaced.
- IAM inheritance, finance workflows, daily availability, public product/order presentation, data model, concurrency checks, reporting, QA, phase planning, and traceability must be synchronized.

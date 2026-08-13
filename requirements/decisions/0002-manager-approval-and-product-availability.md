# ADR-0002 — Manager Approval and Product Availability

> **Approval-role and broad platform-role details superseded for v0.0.1 by ADR-0005.** Product availability-window and capacity-boundary decisions remain useful.

Status: Accepted in part; financial approval and Platform Admin permission limitations are superseded by ADR-0003  
Date: 2026-08-13  
Decision owners: Product and Business  
Supersedes: ADR-0001 decision 14 and its second-finance-approver external gate

## Context

The initial shop has no separate Finance Approver or External Accountant portal role. Product management also needs a clearer shop module and a safe way to plan availability for daily, weekly, monthly, or custom periods without creating capacity outside a product's selling season.

User terminology maps `Admin` to the existing shop-scoped `MANAGER` role. `Content Creator` maps to the existing canonical `CONTENT_EDITOR` role; no additional role enum is introduced.

## Decisions

### 1. Financial approval (superseded by ADR-0003)

- Only a shop `MANAGER` may approve a Picking Entry, expense, or external purchase in MVP.
- The creator/submitter may not approve the same record. Approval therefore still satisfies separation of duties without creating a Finance Approver or External Accountant application role.
- With one active Manager, Staff creates/submits the record and the Manager approves it. If a Manager creates/submits a record, another active Manager must approve it.
- Platform Admin support access and Staff permissions do not grant shop financial approval.
- External accounting or legal advice may still be used for tax/invoice policy, but the adviser is not an MVP portal role.

### 2. Product module and roles (Platform Admin limitation superseded by ADR-0003)

- Products are shop-owned typed records managed in a dedicated Product module.
- Platform Admin in explicit audited support context, Manager, Staff, and Content Editor may create, view, update, localize, activate, archive, and delete an unreferenced product for the active shop. The support-only limitation on Platform Admin is superseded; ADR-0003 grants full Manager authority in selected-shop context.
- Content Editor may manage product identity, localized marketing content, media, and the product availability window, but not package prices or per-date capacity.
- Manager and Staff may manage package/pricing data and per-date capacity. The former support-only limitation on Platform Admin is superseded by ADR-0003.
- A referenced product or package is archived, never hard-deleted. Hard deletion is allowed only when no order, capacity, media/history, purchase, picking, review, analytics, or other retained record references it.

### 3. Product availability window and capacity planning

- Every publicly orderable product has an inclusive `available_from` and `available_through` business-date window in the shop timezone.
- Capacity planners support single-day, ISO-week, calendar-month, and custom-date-range modes. These are authoring conveniences that create/update canonical per-product/per-date availability rows.
- The UI disables dates outside the product window and the server rejects the entire batch if any target date is outside it; no silent clipping or partial write is allowed.
- A product window cannot be shortened across an existing order, capacity reservation, Picking Entry, external purchase, or other retained dated fact. Future unreserved availability outside a proposed shorter window must be explicitly removed in the same confirmed transaction or beforehand.
- Public ordering, manual live orders, packages, and availability all validate the product window server-side.

## Historical consequences (finance item superseded by ADR-0003)

- The earlier finance consequence requiring Manager-only, no-self approval no longer applies; ADR-0003 permits Manager and selected-shop Platform Admin self-approval with audit.
- Product, availability, data, permission, API, form, flow, QA, phase-plan, and traceability documents must be synchronized.
- Exact dates and capacities remain configurable business data rather than hard-coded implementation values.

# 20 — Phase and Release Traceability

> **v0.0.1 traceability override — ADR-0005 applies.** This document retains complete future ID coverage. The release gate is the smaller pilot subset: one shop, role permissions, public order/capacity/pickup, delivery-to-be-agreed/manual fee, CMS/images, invoices/payments, picker records, litre/kg picking records with unit-specific buy prices, i18n, audit, and no Google/Meta calls. Customer orders/capacity remain litres-only.

Version: 1.1
Status: Approved planning baseline  
Date: 2026-08-13

## 1. Purpose

This document assigns every authoritative `FR-*`, `BR-*`, `NFR-*`, and `AC-*` ID to exactly one primary implementation or certification phase and one release gate. It complements the capability-oriented matrix in [12 — Traceability Matrix](12-traceability-matrix.md).

Ranges are inclusive. Comma-separated IDs and ranges form one assignment group. No ID may appear in more than one row within its ID class. Cross-cutting requirements still apply to every affected phase even when their primary certification owner is Phase 8.

## 2. Release model

| Release | Phases | Requirement scope | Acceptance scope |
|---|---|---|---|
| **v0.0.1 Pilot** | P0–P3 | ADR-0005 subset only: one shop, four roles/permissions, catalog/capacity/pickup, manual delivery fee, CMS/images, invoice/payment/picking records, i18n, audit | Pilot subset below; deferred IDs are not release blockers |
| Core Operational Release | 0–8 | All IDs assigned to Phases 1–8 | 66 scenarios assigned to Phases 2–8 |
| Extended MVP Release | 0–11 | Core plus all IDs assigned to Phases 9–11 | All 81 scenarios |

Phase 0 owns decisions, design validation, provider/legal inputs, and backlog readiness. It has no implementation requirement IDs. A production capability remains blocked when its external decision gate is open, even if its code and tests are otherwise complete.

### v0.0.1 acceptance subset

The pilot release gate is the following behavior, regardless of the future ID-to-phase table below: `FR-PUB-001–008`, `FR-ORD-001–018` excluding connector messaging, `FR-PRD-001–007`, `FR-AVL-001–008`, `FR-DLV-001–008` as rewritten for manual delivery, `FR-CMS-001–005`, `FR-IAM-001–005`, `FR-INV-001–003`, basic payment-record rules, record-only external pickers, litre/kg picking records with unit-specific buy prices, Finnish/English localization, image validation/max-four constraint, audit, and capacity concurrency. The pilot must prove: customer order submission, pickup address/instructions, “Delivery to be agreed,” manual fee entry, invoice PDF download, payment record, picker/picking record in either unit, user permission assignment, and no Google/Meta/WhatsApp API call.

All `FR-TEN-*`, `FR-CHN-*`, Google-specific delivery behavior, postal-zone classification, supplier/expense/quality/full finance/reporting, analytics, video, public picker application scenarios, and marketing acceptance scenarios are deferred and do not block v0.0.1. The record-only picker and litre/kg picking subset is in scope.

## 3. Functional requirements

| Primary phase | Release | Functional requirement IDs |
|---:|---|---|
| 1 | Core | FR-PUB-003 |
| 2 | Core | FR-IAM-001–005; FR-TEN-001–007 |
| 3 | Core | FR-PUB-001–002, FR-PUB-004–006; FR-PRD-001–007; FR-AVL-001–008; FR-DLV-001–004; FR-CMS-001–005; FR-SET-001; FR-SRC-001–004 |
| 4 | Core | FR-PUB-007–008; FR-ORD-001, FR-ORD-011, FR-ORD-017; FR-CUS-001–011; FR-DLV-005, FR-DLV-007–008 |
| 5 | Core | FR-ORD-002–010, FR-ORD-012–014, FR-ORD-018; FR-DLV-006; FR-NTF-001–005 |
| 6 | Core | FR-ORD-016; FR-REV-001–005; FR-PIC-001–004; FR-MSG-001–003 |
| 7 | Core | FR-SUP-001–003; FR-QLT-001–004; FR-FIN-001–008; FR-RPT-001–006; FR-DSH-001–002 |
| 9 | Extended | FR-ORD-015; FR-INV-001–004; FR-MED-001–003; FR-ANA-001–004 |
| 10 | Extended | FR-CHN-001–003, FR-CHN-005–006, FR-CHN-010 |
| 11 | Extended | FR-CHN-004, FR-CHN-007–009 |

Coverage total: **143 of 143 functional requirements**.

## 4. Business rules

| Primary phase | Release | Business rule IDs |
|---:|---|---|
| 2 | Core | BR-IAM-001–007; BR-TEN-001–002 |
| 3 | Core | BR-CMS-001–002; BR-SRC-001–002; BR-PRD-001–003; BR-AVL-001–003 |
| 4 | Core | BR-ORD-001–005, BR-ORD-008, BR-ORD-010, BR-ORD-013, BR-ORD-017–019; BR-CUS-001–007; BR-CON-001–004; BR-DLV-001–006; BR-PRV-001–007 |
| 5 | Core | BR-ORD-006–007, BR-ORD-009, BR-ORD-011–012, BR-ORD-014–016; BR-DLV-007–008; BR-PAY-001–005; BR-AUT-001–008 |
| 6 | Core | BR-REV-001 |
| 7 | Core | BR-FIN-001–013; BR-QLT-001–003 |
| 9 | Extended | BR-INV-001–003; BR-MED-001–002; BR-ANA-001–002 |
| 10 | Extended | BR-CHN-002, BR-CHN-004–005 |
| 11 | Extended | BR-CHN-001, BR-CHN-003 |

Coverage total: **106 of 106 business rules**.

## 5. Non-functional requirements

| Primary certification phase | Release | Non-functional requirement IDs |
|---:|---|---|
| 8 | Core | NFR-PERF-001–006; NFR-REL-001–007; NFR-SEC-001–010; NFR-PRV-001–008; NFR-ACC-001–005; NFR-USA-001; NFR-L10N-001–004; NFR-OBS-001–002; NFR-MNT-001–004 |

Coverage total: **47 of 47 non-functional requirements**. These are Definition-of-Done constraints from the first affected implementation phase; Phase 8 is the primary Core certification owner. Phases 9–11 must re-run the relevant gates for their new media, analytics, invoice, and provider surfaces.

## 6. Acceptance scenarios

| Primary phase | Release | Acceptance scenario IDs |
|---:|---|---|
| 2 | Core | AC-IAM-001–003; AC-TEN-001–004 |
| 3 | Core | AC-CMS-001; AC-SRC-001; AC-PRD-001–003; AC-AVL-001 |
| 4 | Core | AC-ORD-001–004, AC-ORD-007, AC-ORD-010–011, AC-ORD-014–016, AC-ORD-019; AC-DLV-001–003; AC-CUS-001–003; AC-PRV-001–002; AC-AVL-002 |
| 5 | Core | AC-ORD-005–006, AC-ORD-008–009, AC-ORD-012–013, AC-ORD-017–018; AC-AUT-001–005; AC-PAY-001; AC-NTF-001–002 |
| 6 | Core | AC-DOC-001; AC-REV-001; AC-PIC-001; AC-MSG-001 |
| 7 | Core | AC-FIN-001–008; AC-RPT-001–002; AC-QLT-001; AC-AVL-003 |
| 8 | Core | AC-ACC-001 |
| 9 | Extended | AC-INV-001–003; AC-MED-001; AC-ANA-001–003 |
| 10 | Extended | AC-CHN-001–005 |
| 11 | Extended | AC-CHN-006–008 |

Coverage total: **81 of 81 acceptance scenarios**: 66 Core and 15 Extended.

## 7. Phase dependency and gate rules

1. Phases 0–5 are sequential.
2. Phases 6 and 7 may overlap only after Phase 5 is stable.
3. Phase 8 depends on both Phases 6 and 7 and certifies Core.
4. Phases 9 and 10 both depend on Phase 8 and may run in parallel.
5. Phase 11 depends on both Phases 9 and 10 and certifies Extended MVP.
6. A phase may not be marked `COMPLETE` until every ID in its rows has implementation/test evidence or an accepted ADR explicitly moves/reclassifies it.
7. Core release requires all 66 Core acceptance scenarios. Extended MVP requires all 81 scenarios.

## 8. Change control

When adding, removing, or moving an ID:

1. Update its authoritative source document.
2. Update the capability mapping in document 12 when affected.
3. Update this exact phase/release assignment and totals.
4. Update document 19 phase deliverables, status, and progress log.
5. Record a decision when the change alters approved behavior, release scope, or phase dependencies.

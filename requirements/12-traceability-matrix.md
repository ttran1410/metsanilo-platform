# 12 — Traceability Matrix

This matrix groups related requirements to keep maintenance practical. Detailed test cases should reference the individual ID, applicable business rule, and acceptance scenario. Exact one-phase/one-release ownership is defined in [20 — Phase and Release Traceability](20-phase-and-release-traceability.md).

| Capability | Functional requirements | Business rules | Primary acceptance coverage |
|---|---|---|---|
| Public pages/locales/availability presentation | FR-PUB-001–008 | BR-CMS-001–002; BR-AVL-001–002 | AC-CMS-001; AC-AVL-002; form/a11y/l10n suite |
| Public order creation | FR-ORD-001, 011, 013, 017 | BR-ORD-001–005, 008, 010, 013, 019 | AC-ORD-001–004, 010–011, 019 |
| Manual/historical orders | FR-ORD-002–004 | BR-ORD-011, 014; BR-CON-002 | AC-ORD-008–009 |
| Order management | FR-ORD-005–010, 014, 018 | BR-ORD-006–009, 012, 014–016 | AC-ORD-005–007, 012–013, 018; AC-AUT-005 |
| Payment recording | FR-ORD-012 | BR-PAY-001–005 | AC-PAY-001; AC-ORD-017 |
| Customer identity/history | FR-CUS-001–007 | BR-CUS-001–006; BR-CON-001–003 | AC-CUS-001–003; AC-PRV-002; AC-ORD-015 |
| Product module/window/packages | FR-PRD-001–007 | BR-PRD-001–003; BR-ORD-002–005 | AC-PRD-001–003; AC-ORD-001, 007 |
| Bounded availability/capacity/manual sold-out | FR-AVL-001–008 | BR-PRD-001–003; BR-AVL-001–003; BR-ORD-003, 005–009 | AC-PRD-002–003; AC-AVL-001–003; AC-ORD-001–003, 005–007 |
| Pickup/delivery | FR-DLV-001–008 | BR-DLV-001–008 | AC-DLV-001–003; AC-ORD-016 |
| CMS | FR-CMS-001–005 | BR-CMS-001–002 | AC-CMS-001 |
| Reviews | FR-REV-001–005 | BR-REV-001; BR-PRV-005 | AC-REV-001 |
| Picker applications | FR-PIC-001–004 | BR-CON-003–004 | AC-PIC-001 |
| Contact messages | FR-MSG-001–003 | BR-CON-003–004 | AC-MSG-001 |
| IAM/RBAC | FR-IAM-001–005 | BR-IAM-001–007 | AC-IAM-001–003; security suite |
| Settings/dashboard | FR-SET-001; FR-DSH-001–002 | BR-AUT-001; BR-DLV-002 | dashboard/config tests |
| New-order reminder | FR-NTF-001–002, 004–005 | BR-AUT-007–008 | AC-NTF-001–002 |
| Picking/ready automation | FR-NTF-003, 005 | BR-AUT-001–007 | AC-AUT-001–004 |
| Marketing/privacy | FR-CUS-006–007 | BR-PRV-001–006 | AC-PRV-001–002; privacy suite |
| Performance/reliability | — | BR-ORD-008; BR-AUT-007 | NFR-PERF-*, NFR-REL-*; load/recovery suite |
| Security | — | BR-IAM-* | NFR-SEC-*; security suite |
| Accessibility/localization | FR-PUB-003 | canonical form behavior | NFR-ACC-*, NFR-L10N-*; AC-ACC-001; a11y/l10n suite |
| Suppliers/external purchases | FR-SUP-001–003 | BR-FIN-004, 008, 010 | AC-FIN-005, 007 |
| Expenses/allocations | FR-FIN-001–003, 007 | BR-FIN-004, 007, 010–011 | AC-FIN-004, 007; owner-authority audit suite |
| Staff picking/earnings | FR-FIN-004–008 | BR-FIN-005, 009–011 | AC-FIN-006–008 |
| Reports/exports | FR-RPT-001–006 | BR-FIN-001–013; BR-AVL-003 | AC-FIN-001–005; AC-AVL-003; AC-RPT-001–002 |
| Invoice PDF | FR-ORD-015; FR-INV-001–004 | BR-INV-001–003 | AC-INV-001–003 |
| Product media gallery | FR-MED-001–003 | BR-MED-001–002 | AC-MED-001 |
| Fixed public quantity/manual quantity | FR-PRD-005–006 | BR-ORD-004, 018 | AC-ORD-011 |
| Configurable order sources | FR-SRC-001–004 | BR-SRC-001–002 | AC-SRC-001 |
| Customer identity/area/navigation | FR-CUS-008–011 | BR-CUS-002, 007 | AC-ORD-014; customer matching suite |
| Decline/customer cancellation | FR-ANA-004; FR-ORD-007, 018 | BR-ORD-007, 015–016 | AC-ORD-012–013 |
| Historical order reporting | FR-ORD-004, 017; FR-RPT-006 | BR-ORD-011, 017; BR-FIN-001 | AC-ORD-009–010 |
| External quality/buy price | FR-QLT-001–004 | BR-QLT-001–003 | AC-QLT-001 |
| Order Summary PDF | FR-ORD-016 | document snapshot rules | AC-DOC-001 |
| Tenant/shop platform | FR-TEN-001–007 | BR-TEN-001–002; BR-IAM-004–005 | AC-TEN-001–004 |
| Funnel/abandonment analytics | FR-ANA-001–004 | BR-ANA-001–002; BR-PRV-007 | AC-ANA-001–003 |
| Channel connections/publishing | FR-CHN-001–003, 009–010 | BR-CHN-003, 005 | AC-CHN-001–002, 008 |
| Shared inbox | FR-CHN-005–006 | BR-CHN-004 | AC-CHN-003–005 |
| Segments/WhatsApp messaging | FR-CHN-004, 007–009 | BR-CHN-001–003; BR-PRV-002–003 | AC-CHN-006–008 |

## Requirement completion definition

A requirement is Done only when:

1. Behavior and UX are implemented in both locales where customer-facing.
2. Server-side validation/authorization and audit are implemented.
3. Relevant unit/integration/API/E2E/accessibility tests pass.
4. Data migration/rollback and observability are addressed where applicable.
5. PO accepts mapped scenarios and QE records evidence.

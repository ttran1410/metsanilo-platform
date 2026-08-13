# ADR-0001 — Pre-implementation Baseline Resolutions

Status: Accepted; decisions 1 and 14 plus the second-finance-approver gate are superseded by ADR-0003; the delivery-classification external gate is refined by ADR-0004  
Date: 2026-08-13  
Decision owners: Product and Engineering  
Applies from: Documentation baseline 1.5

## Context

Two complete documentation audits found conflicts between early scope prose, detailed requirements, the architecture synthesis, and the development plan. Implementing against those conflicts would create incompatible order, capacity, identity, permission, finance, marketing, and release behavior.

## Decisions

1. **Roles (superseded):** current Admin/Manager inheritance is defined by ADR-0003.
2. **MFA:** every human Platform Console and shop-portal user must use MFA. Service identities are non-interactive and use separate controls.
3. **Marketing:** manually composed/scheduled, consent-aware broadcasts are MVP. Autonomous, event-triggered, and drip marketing automation is deferred.
4. **Marketing consent:** the initial public direct-marketing statement names WhatsApp only. Messenger may be added only after it is enabled and legally/provider-approved. Facebook Page publishing is not customer direct marketing.
5. **Historical orders:** privileged historical entry may represent evidence-appropriate terminal outcomes. Historical refund entry records completion first and refund second; a bare unexplained refund is invalid.
6. **Customer conflicts:** public identity conflicts create a provisional customer flagged for staff resolution. Existing candidates are not auto-linked or merged, and submitted snapshots remain immutable.
7. **Order lines:** public MVP orders contain exactly one item line. Manual/historical orders may contain multiple lines sharing one fulfillment date and method.
8. **Manipulated quantity:** public MVP quantity is always 1. A submitted non-1 public quantity is rejected; it is not silently normalized.
9. **Pending delivery price:** outside/unverifiable delivery stores authoritative item subtotal but null/pending delivery fee and final total until agreement. Confirmation is blocked until resolved.
10. **Capacity after work starts:** cancellations from `NEW`/`CONFIRMED` release capacity once. Cancellations after `PICKING` begins record consumed/waste litres and do not reopen availability automatically.
11. **Refunds:** partial refund keeps the completed fulfillment status and sets payment summary `PARTIALLY_REFUNDED`. Only full cumulative refund transitions the order to `REFUNDED`.
12. **Contract formation:** public submit creates a reservation request; sales-contract formation is recorded on staff confirmation after required agreement. The timing must be prominent and unavoidable in the order path, and no charge occurs before confirmation. Final wording and legal effect remain subject to Finnish consumer-law review.
13. **Quality permission:** Manager has quality/rate configuration. Staff is denied by default and may receive `quality.configure` explicitly.
14. **Financial approval (superseded):** external purchases use `DRAFT → SUBMITTED → APPROVED → PAID` with rejection/correction. Current approval authority is defined by ADR-0003.
15. **i18n:** Finnish is the initial default and English is supported across public/portal/document surfaces. Public routes use locale prefixes and localized slugs backed by stable route IDs. Formatting is initially `fi-FI`/`en-FI`, EUR, and `Europe/Helsinki`. Swedish is architecturally supported but deferred.
16. **Technical baseline:** TypeScript/Next.js modular monolith, PostgreSQL, PostgreSQL-backed durable jobs/outbox, managed OIDC/MFA, EU S3-compatible storage, typed contracts, and server-rendered PDFs. Named products and the final test runner remain Phase 0 selections.
17. **Delivery dependencies:** Phases 9 and 10 both depend on Phase 8 and may run in parallel. Phase 11 depends on both.
18. **Release acceptance:** every acceptance scenario is required for the Extended MVP unless a later accepted ADR reclassifies it. The Core release uses the explicit subset in the phase traceability document.

## External gates not decided by this ADR

- Initial catalog, cutoff, exact delivery origin/distance/fees/fallback values under ADR-0004, and pickup schedule.
- Consumer terms, seller disclosures, withdrawal/cancellation and perishable-goods legal treatment.
- Operating-company microenterprise status and resulting Finnish accessibility obligations.
- Retention, processors, hosting selections, Google Maps EEA/privacy/billing/credential production approval under ADR-0004, analytics wording, and Meta/BSP approval.
- VAT/invoice/accounting policy. The shop approval-role model is resolved by ADR-0002.

These do not authorize guessing. Each affected production gate remains blocked until its accountable owner records approval.

## Consequences

- Detailed requirement, lifecycle, form, data, permission, QA, synthesis, and plan documents must reflect these decisions.
- Domain tests must cover every edge case above.
- Any change to these decisions requires another ADR and corresponding requirement-ID updates.

# 14 — Glossary and Open Decisions

## 1. Glossary

| Term | Definition |
|---|---|
| Product availability window | Inclusive `available_from`–`available_through` business dates in which live availability/order dates may exist. |
| Availability | Product capacity for a specific business date inside the product availability window, measured in litres. |
| Capacity | Maximum litres the business accepts for a product/date. |
| Reserved litres | Litres committed by capacity-holding orders. |
| Remaining litres | Capacity minus reserved litres. |
| Manual sold-out | Private audited per-product/date override that stops new orders and presents “Sold out” publicly without changing capacity or transaction facts. |
| Package | Fixed purchasable amount of a product, e.g. 2 L, 5 L, 10 L. |
| Quantity | Positive whole number of packages; fixed to 1 in public MVP and configurable only for authorized manual/historical entry. |
| Order | Customer reservation record, requiring staff confirmation. |
| Order source | Website, WhatsApp, Messenger, SMS, phone, or other origin. |
| `created_at` | Instant the system created the order record. It does not control picking automation. |
| Fulfillment date | Business date on which pickup/delivery should occur. |
| Fulfillment method | Pickup or delivery. |
| Pickup slot | Configured location and time window; global default initially 20:00. |
| Service area | Delivery eligibility derived from the approved provider's shorter driving-route distance; postal zones are fallback/reporting aids. |
| Delivery origin | Shop-configured dispatch address; Google validation is required before automatic Google route quoting can be enabled. |
| Delivery agreement | Manual staff/customer decision for outside/unverifiable coverage and fee. |
| Customer profile | Current deduplicated operational customer record. |
| Order snapshot | Historical copy of customer/item/price/fulfillment facts at order time. |
| Marketing consent | Optional, affirmative, purpose-specific permission; unchecked by default. |
| CMS | Structured management of public page content; not operational data. |
| Audit event | Append-only attribution of an important action/change. |
| Idempotency | Repeating the same request/job does not create duplicate business effects. |
| Business timezone | `Europe/Helsinki`, used for operational schedules and business dates. |
| Overdue `NEW` | Order unresolved for at least 15 minutes. |
| Overdue `PICKING` | Today’s order still picking at configured ready-review time. |
| Recognized revenue | Completed-order amount recognized when the order first becomes `PICKED_UP` or `DELIVERED`. |
| Net revenue | Gross recognized revenue minus refunds recognized in the period. |
| Non-staff operating costs | Approved external purchases, fuel, packaging, equipment/allocation, and other costs, excluding staff picking earnings. |
| Result before staff picking cost | Net revenue minus non-staff operating costs. This shows performance before valuing staff picking labor. |
| Staff picking cost/income | Approved earnings owed to staff for recorded picking activity; a business cost and staff income. |
| Estimated operating profit | Result before staff picking cost minus staff picking cost. Not statutory/taxable accounting profit. |
| Picking Entry | Staff + product + picking date production/compensation record, not allocated to orders. |
| Supplier | External picker/vendor profile, separate from staff, customer, and applicant. |
| Expense allocation | Reporting assignment of one source cost across one or more periods. |
| Invoice snapshot | Versioned seller/customer/line/tax/payment data used to render an issued invoice PDF. |

## 2. Resolved product decisions

- Public ordering creates a pending reservation request in `NEW`; Manager/permitted Staff records sales-contract formation on confirmation or cancels/declines it. The timing is prominent and unavoidable before submit, no charge occurs before confirmation, and exact terms require Finnish legal approval.
- Manual and historical terminal-outcome orders are supported and audited; a historical refund preserves completion followed by refund chronology.
- Cash, bank transfer, and MobilePay are recorded without integration.
- Capacity is litres; fixed packages × positive integer quantity. Public orders use one item line; staff-entered orders may use multiple lines with one fulfillment date/method.
- `NEW`/`CONFIRMED` reserve capacity. Pre-picking cancellation releases it atomically; post-picking cancellation records consumed/waste capacity without reopening availability.
- Pickup defaults to 20:00 but supports global, weekday, and date settings.
- Local delivery uses configurable threshold/fee; outside area is manually agreed and fee/final total stay null/pending until agreement.
- No customer account or automatic customer messages in MVP; authorized explicit transactional channel actions are allowed.
- Customer match priority: mobile, email, Messenger. Conflicts create a provisional customer for staff resolution without auto-link/merge.
- Platform Admin, Manager, Staff, and Content Editor roles are included; MFA is mandatory for every human portal user.
- Manager is the shop owner and receives every shop-scoped application permission. Platform Admin inherits all Manager authority in selected-shop context plus platform shop-management/security permissions.
- “Content Creator” is the user-facing alias for canonical `CONTENT_EDITOR`. Platform Admin in selected-shop context, Manager, Staff, and Content Editor manage shop products; Platform Admin/Manager/Staff manage package prices and per-date capacity.
- Products have an inclusive shop-timezone availability window. Capacity may be authored by day, ISO week, calendar month, or custom range, but never outside that window.
- Manager and Platform Admin in selected-shop context may perform every financial workflow action, including approving/paying a record they created/submitted. Every step remains audited; there is no Finance Approver or External Accountant portal role.
- Platform Admin, Manager, and Staff may set a private daily manual-sold-out override. Public UI shows the same “Sold out” state as natural exhaustion, while internal reporting distinguishes the cause and never fabricates sales, litres, expenses, or fulfillment.
- Public reviews require moderation; original content remains auditable.
- Picker functionality ends at application management in MVP.
- Shop-user notifications are in-app plus per-user configurable email.
- 10:00 automation uses fulfillment date; 19:00 reminds but never auto-sets `READY`.
- Finnish/English, EUR, Pori/Satakunta, and Europe/Helsinki are initial defaults.
- Weekly reports show results before and after staff picking cost, using ISO Monday–Sunday periods.
- Staff compensation supports per-litre, per-hour, fixed, and approved manual adjustment methods.
- Supplier profiles and external berry purchases are managed separately.
- CSV and PDF report exports are MVP; invoice PDFs are downloadable but not automatically emailed.

## 3. Implementation-time decisions still required

These do not block this requirements baseline, but must be decided before the related story is Ready/production launch:

| Decision | Owner | Needed by | Constraint |
|---|---|---|---|
| Exact same-day public order cutoff | Business/PO | Order configuration | Must be configurable and support date override |
| Exact initial product/package/price catalog | Business | Seed data/content | Historical snapshots required |
| Delivery-origin address, 5,000 m maximum, free threshold, local fee, and manual-fallback policy | Business/Operations | Delivery release | Google provider and shorter-driving-distance interpretation resolved in ADR-0004; exact business values remain open |
| Initial free-delivery threshold/local fee | Business | Delivery release | Defaults discussed: 20 L / €3, but configured data is authoritative |
| Pickup location(s), weekday schedule and exceptions | Operations | Fulfillment release | Default time 20:00 |
| Tax/VAT display and accounting record requirements | Business | Production | Obtain qualified accounting advice where needed; no adviser portal role is implied |
| Data retention durations and deletion/anonymization detail | Legal/Business | Production privacy approval | Purpose-specific and documented |
| Operational email recipients/categories/escalation repeat policy | Operations | Notification release | Initial 15-minute reminder exactly once |
| Supported browser/device test matrix details | PO/QE | Test plan | Must include iOS Safari/Android Chrome |
| Hosting region, subprocessors, analytics/cookies | Security/Privacy | Production | Requires privacy/security assessment |
| Exact identity provider, invitation, recovery and service-identity policy | Security/Platform owner | Portal release | Human portal MFA is mandatory |
| Whether Staff may execute refunds | Business/Manager | Permission configuration | Separate permission; Manager default |
| Invoice eligibility timing, payment terms, number format, required legal fields, VAT/tax text and correction/credit-note policy | Business | Invoice production release | Obtain qualified accounting advice; no adviser portal role is implied |
| Receipt requirements and finance workflow evidence/thresholds | Business/Manager | Finance release | Manager/Admin self-approval is allowed; action-by-action audit remains mandatory |
| Default staff compensation rates and whether approved cost belongs to picking date or an accounting allocation date | Business | Staff earnings release | Picking-date basis is the current management-report default |
| Consumer terms, seller disclosures, contract-formation wording, cancellation/withdrawal rules, and perishable-goods treatment | Legal/Business | Public ordering production release | Finnish consumer-law review required |
| Whether the operating company qualifies as a microenterprise for Finnish digital-service accessibility law | Legal/Business | Accessibility compliance plan | Record employee count and turnover/balance-sheet evidence; WCAG 2.2 AA remains a product requirement regardless |

## 4. Future-compatible concepts, not MVP commitments

Online payment, customer accounts, automatic customer messages, route optimization, picker supply/payment, autonomous/event-triggered/drip marketing automation, additional capacity units, additional markets/currencies, promotions, refunds integration, and accounting integration. Manually composed/scheduled consent-aware broadcasts remain MVP. Extension fields/interfaces may exist, but no MVP acceptance may depend on the deferred concepts.

## 5. Official compliance review inputs

These sources inform the open gates but do not replace qualified legal advice:

- [Finnish Competition and Consumer Authority: information presented to consumers in online stores](https://www.kkv.fi/kuluttaja-asiat/tietoa-ja-ohjeita-yrityksille/verkkokauppiaille/kuluttajalle-annettavat-tiedot-ja-niiden-esittaminen-verkkokaupoissa/) — pre-contract information, terms in the order path, payment-obligation presentation, and durable confirmation.
- [Finnish Competition and Consumer Authority: online-store terms, offer binding, cancellation and returns](https://www.kkv.fi/paatokset/kuluttaja-asiat/kuluttaja-asiamiehen-ratkaisut/verkkokaupan-ehdot-tarjouksen-sitovuus-peruuttamisoikeus-ja-palauttamiskaytannot/) — requirements for making a later contract-formation point visible in the purchase path.
- [Traficom: new accessibility requirements](https://www.traficom.fi/en/tv-and-radio/accessibility-audiovisual-content/new-accessibility-requirements) — e-commerce service scope from 28 June 2025, microenterprise treatment, and service-provider obligations.

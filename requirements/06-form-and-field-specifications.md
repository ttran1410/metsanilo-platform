# 06 — Form and Field Specifications

## 1. Shared form design standard

All public forms are mobile-first, single-column by default, and use visible labels rather than placeholder-only labels. Related fields are grouped, conditional fields appear immediately after the controlling choice, and computed totals are summarized before submission.

Every form must provide:

- Finnish and English labels, help, errors, and success states.
- Required-field markers explained once at the start.
- Client validation for responsiveness and authoritative server validation.
- A focusable error summary linking to invalid fields.
- Preservation of entered values after correctable errors.
- Loading/submitting state and prevention of accidental duplicate submission.
- Stable error codes mapped to localized text.
- Spam/rate-limit protection that remains accessible.
- A privacy notice link and purpose-specific acknowledgement/consent where specified.
- Maximum lengths enforced in UI, API, and database.

Example canonical messages:

| Code | English | Finnish |
|---|---|---|
| `REQUIRED` | This field is required. | Tämä kenttä on pakollinen. |
| `INVALID_PHONE` | Enter a valid mobile number. | Anna kelvollinen matkapuhelinnumero. |
| `INVALID_EMAIL` | Enter a valid email address. | Anna kelvollinen sähköpostiosoite. |
| `POSITIVE_INTEGER` | Enter a whole number greater than zero. | Anna nollaa suurempi kokonaisluku. |
| `CAPACITY_CHANGED` | Availability changed. Only {litres} L remains for this date. | Saatavuus on muuttunut. Tälle päivälle on jäljellä vain {litres} l. |
| `DATE_CLOSED` | Orders are closed for this date. Choose another date. | Tilaukset tälle päivälle on suljettu. Valitse toinen päivä. |
| `RETRY_LATER` | We could not submit the form. Your information is still here—please try again. | Lomaketta ei voitu lähettää. Tietosi ovat tallessa – yritä uudelleen. |

## 2. Public order form

### 2.1 Layout

```text
Order your berries
  1. Product and amount
  2. Date and pickup/delivery
  3. Your details
  4. Review order
  [Submit reservation]
```

This may be one page with grouped sections or an accessible stepper. Changing earlier values must update later conditional fields and totals without losing customer data.

### 2.2 Fields

| Field | Type | Required | Validation/default/behavior |
|---|---|---:|---|
| Locale | hidden/session | Yes | `fi` or `en`; selected site locale |
| Product | select/cards | Yes | Active and publicly orderable |
| Package | select/cards | Yes | Active package for selected product; show litres and price |
| Quantity | implicit constant | Yes | Exactly `1`; no public control is rendered and the server rejects any manipulated non-1 value |
| Total litres | computed | Yes | `package_litres × quantity`, server recomputed |
| Item subtotal | computed | Yes | Server-authoritative EUR amount |
| Fulfillment date | date/list | Yes | Only open dates with sufficient capacity and before cutoff |
| Fulfillment method | radio | Yes | `PICKUP` or `DELIVERY`, subject to configured availability |
| Pickup location | select | Conditional | Required for pickup; active on selected date; selection exposes complete address and localized instructions |
| Pickup time slot | select | Conditional | Required for pickup; default derived date → weekday → global, initially 20:00 |
| Recipient/customer name | text | Yes | Trimmed, 2–120 characters |
| Mobile number | tel | Yes | Valid, normalized; 7–30 raw characters |
| WhatsApp number | tel + same-as-mobile | No | Defaults to primary mobile when customer selects “same”; otherwise separately normalized |
| Email | email | No | Maximum 254 characters; normalized lowercase for matching |
| Messenger identifier/link | text | No | Maximum 255; safely encoded |
| Street address | text | Delivery | 2–160 characters |
| Postal code | text | Delivery | Finnish format initially: five digits; architecture permits other market rules |
| City | text | Delivery | 2–100 characters |
| Customer area | computed/hidden | No | Derived after address/postal mapping when possible; customer does not need to choose it publicly |
| Delivery classification | computed | Delivery | Inside, outside, or unverifiable service area |
| Driving distance | computed | Delivery | Backend/provider result in metres/km; customer-friendly display may round for presentation but fee uses integer metres |
| Delivery fee | computed | Delivery | Free/local fee or null/“to be agreed”; server recomputed |
| Final total | computed | Yes | Item subtotal plus delivery fee; null/pending when a required delivery fee is not yet agreed |
| Customer notes | textarea | No | Maximum 1,000 characters; plain text |
| Privacy acknowledgement | checkbox | Yes | Acknowledges notice/necessary processing; unchecked initially |
| Marketing consent | checkbox | No | Unchecked and optional; initial statement names WhatsApp only and creates channel-specific evidence |
| Anti-spam token | hidden/widget | Yes | Valid server verification where enabled |
| Idempotency token | hidden | Yes | Unique per form attempt; retained on retry |

### 2.3 Dynamic behavior

- Product filters packages and dates.
- Package/date changes requery indicative capacity and recalculate subtotal. Public quantity is fixed to 1 with no quantity control; the server rejects manipulated non-1 input.
- An otherwise open product/date with positive capacity shows exact remaining litres. Natural zero or manual sold-out shows `Loppuunmyyty` in Finnish or `Sold out` in English from i18n resources, disables selection/submission, and exposes neither a numeric remainder nor the private override cause.
- Pickup hides and clears delivery-only fields and shows the selected location's complete address/instructions in selection and Review; delivery hides and clears pickup selections.
- With effective Google delivery enabled, a complete destination is provider-validated, the customer confirms any normalized suggestion, and the backend calculates the shorter driving route. At `distance_metres <= configured maximum` the volume threshold rule applies. With integration disabled, local format validation runs without a Google delivery call and the UI immediately shows the same non-final “to be agreed” fee used for beyond/unverified/no-route/provider failure.
- The Review section shows all values, pending/manual fee warnings, and “This reservation requires confirmation by METSÄNILO.” When delivery fee is pending it shows the authoritative item subtotal and labels delivery fee/final total “to be agreed” instead of displaying a misleading numeric total.
- Final submit revalidates everything. The UI result cannot override server price/capacity.
- Fulfillment date options never include a past business date in the resolved shop timezone.
- Marketing consent text initially names the shop, purpose, and WhatsApp. Adding a new direct-marketing channel requires separately approved channel-specific wording and a new affirmative action; it does not inherit the old choice.

### 2.4 Success state

Show public order reference, items, litres, date, method, and the message that staff will confirm externally. For pickup, show the snapshotted location name, complete address, localized instructions, and time slot. For delivery, show the customer destination address, fee state, and total (or delivery fee pending). Do not claim that the order is confirmed and do not send customer email/SMS.

## 3. Shop-portal manual-order form

Includes all order fields plus:

| Field | Required | Rules |
|---|---:|---|
| Order entry mode | Yes | Normal or historical completed |
| Source | Yes | Selected from active shop-configured sources; website, WhatsApp, Messenger, SMS, phone, other may be seeded defaults |
| Existing customer | Conditional | Search by name/phone/email/Messenger; ambiguity requires selection |
| Contact channel used | Confirmed order | Channel and agreement timestamp |
| Initial/outcome status | Yes | Normal: `NEW`/`CONFIRMED`; historical: applicable terminal outcome such as `PICKED_UP`, `DELIVERED`, `CUSTOMER_DECLINED`, cancellation variant, `REJECTED`, or `NO_SHOW`. Historical refund entry must first capture the completed-sale fact and then its refund event/evidence. |
| Manual override reason | Conditional | Required for cutoff, delivery fee, status, or historical entry override |
| Fulfilled at | Historical | Date/time cannot be implausibly future |
| Payment method/status | Historical | Required; `PAID` requires paid timestamp |
| Internal notes | No | Maximum 2,000; never shown publicly |

If mobile is absent, at least email or Messenger is required and the exception reason must be entered. Historical order creation clearly warns that it does not change live availability but does contribute to reports using its actual outcome/fulfillment dates. It may use a past fulfillment date; normal/public mode may not.

The public order form creates exactly one item line. Manual/historical forms may add multiple item lines, but all lines must share one fulfillment date and method.

## 4. Contact form

| Field | Type | Required | Validation |
|---|---|---:|---|
| Name | text | Yes | 2–120 characters |
| Email | email | Conditional | At least email or mobile; max 254 |
| Mobile | tel | Conditional | At least email or mobile; normalized |
| Category | select | Yes | Order, delivery, berry supply, picker, cooperation, other |
| Order reference | text | No | Shown/recommended for order/delivery categories; valid format if entered |
| Subject | text | Yes | 3–150 characters |
| Message | textarea | Yes | 10–3,000 characters |
| Privacy acknowledgement | checkbox | Yes | Unchecked initially |
| Anti-spam token | hidden/widget | Yes | Server verified |

Success reveals a non-sensitive request reference and does not promise an automated reply.

## 5. Picker application form

| Field | Type | Required | Validation |
|---|---|---:|---|
| Full name | text | Yes | 2–120 characters |
| Mobile | tel | Yes | Valid normalized number |
| Email | email | No | Max 254 |
| Municipality/location | text | Yes | 2–120 characters |
| Has car/transport | radio | Yes | Yes/No |
| Produce interests | checkbox group | Yes | At least one configured option, e.g. bilberry/lingonberry/raspberry/mushroom |
| Expected amount/day | number + unit | No | Positive decimal up to configured maximum; informational, not capacity |
| Availability/start date | date | No | Valid date |
| Experience | textarea | No | Max 1,500 |
| Additional information | textarea | No | Max 1,500 |
| Privacy acknowledgement | checkbox | Yes | Unchecked initially |
| Anti-spam token | hidden/widget | Yes | Server verified |

The public form must not request bank, tax, national identity, health, or other unnecessary sensitive information.

## 6. Public review form

| Field | Type | Required | Validation |
|---|---|---:|---|
| Display name | text | Yes | 2–80 characters; warns it may be public |
| Email/mobile | text | No | Stored for moderation only and never displayed; one may be configured required later |
| Product | select | No | Active or historical public product |
| Rating | radio/stars | Yes | Integer 1–5 with accessible labels |
| Review text | textarea | Yes | 10–2,000 characters |
| Publication acknowledgement | checkbox | Yes | Explicitly permits publishing display name/rating/text after approval |
| Anti-spam token | hidden/widget | Yes | Server verified |

Manager/permitted Staff review form additionally captures source, original content (read-only after creation), display content, moderation status, featured flag, publish dates, moderation reason, and audit actor.

## 7. Core admin forms

### 7.1 Customer

Name (required), primary/normalized mobile, WhatsApp number with “same as primary” option, email, Messenger/Facebook display name, stable provider identifier (read-only when provider-owned), addresses, optional area, area source/confidence/manual override, preferred contact channel, channel-specific consent evidence, internal notes, active/anonymized state. Duplicate warnings do not silently merge. Anonymize requires confirmation, reason, and impact preview.

The profile summary displays order count, completed count, recognized revenue/lifetime value, latest order/activity, and “View all orders,” linking to the shop-scoped Orders list by customer ID. Order list/detail customer links support opening in a new tab without personal data in the URL.

### 7.2 Product and package

Product code/slug, Finnish/English names/descriptions, ordered media gallery, unit base (`LITRE`), required inclusive `available_from`/`available_through` business dates, active/public flags, and display order. Start must not follow end. Changing the window shows affected capacity and retained facts; a forbidden shortening is blocked. Gallery supports images, uploaded videos, and allowlisted YouTube/Vimeo URLs; one primary item, localized caption/alt/transcript metadata, preview, archive, and ordering. External video URL is visually recommended over upload.

Platform Admin in explicit selected-shop context, Manager, Staff, and Content Editor may manage the product record. Content Editor sees package price/capacity as read-only. Delete first shows a reference check: an unreferenced product may be hard-deleted with confirmation; otherwise only archive is offered.

Package includes immutable identifier, localized label, positive litre amount, non-negative EUR price, active dates/state, and display order. Litres/price changes affect new orders only. Public MVP quantity is always 1; package size is the volume choice. Manual/historical-order quantity remains a positive integer. A manipulated public non-1 quantity is rejected, never silently normalized.

### 7.3 Availability planner

Product and planning mode (`DAY`, `ISO_WEEK`, `CALENDAR_MONTH`, `CUSTOM_RANGE`), selected week/month or inclusive start/end dates, capacity litres (non-negative decimal with configured precision), accept-orders toggle, per-date `manual_sold_out` toggle, required internal sold-out reason when set, order cutoff, picking start, ready-review time, pickup location/time override, and internal note. `accepts_orders = false` is an ordinary unavailable/closed scheduling state; `manual_sold_out = true` is the deliberate public “Sold out” presentation while internal capacity remains factual. Show the product window plus resolved target dates, reserved litres, projected remaining litres, effective public state, and natural/manual sold-out cause internally. Dates outside the window and historical dates are disabled; the shop's current business date remains editable even after cutoff. The server rejects the entire command if any resolved date is invalid, capacity is below reserved, or authorization fails; no silent clipping or partial write. Saving capacity does not override cutoff/order-acceptance state. Manual sold-out never changes existing reservations or totals. Public disclosure is fixed by FR-PUB-005 rather than configurable here.

### 7.4 Pickup location/time slot

Platform Admin in selected-shop context, Manager, and Staff manage localized name/instructions, customer-visible street address, postal code, city, optional access details, timezone, active state/dates, weekday defaults, date overrides, start/end time, optional order limit, and display order. End must be after start. Preview shows exactly what checkout/review/success will disclose.

### 7.5 Delivery rule

Platform Admin in selected-shop context, Manager, and Staff manage the delivery-origin/dispatch name/address plus rule name, priority, active dates, maximum driving distance metres (initially 5,000), free threshold litres, local fee EUR, fulfillment dates/method availability, fallback postal zones/text, and outside-distance/provider-failure policy. Platform Admin/Manager additionally see the audited per-shop “Automatic Google delivery quote” toggle; only Platform Admin sees the platform kill switch. New shops default off. Enabling requires credentials/gates and a successfully validated origin. Disabling warns that unconsumed quotes expire and all new delivery requests use “to be agreed” without Google calls. Threshold, distance, and fee must be non-negative.

### 7.6 CMS editor

Page/section, locale tabs, title, rich text limited to safe components, CTA label/link, media, alt text, SEO title/description, draft/publish controls, preview, revision note. Unsafe markup and broken internal links are rejected.

### 7.7 User and role

User: identity, email, status, locale/timezone and shop memberships. Membership: shop, role(s), state and notification settings. Shop Role: name, description, permission checklist. Prevent removal of the last Platform Admin and prevent an active shop from losing its last Manager without replacement/closure.

### 7.8 Settings

Shop identity/contact, default/supported locales, currency, timezone, picking/ready/pickup times, cutoff, delivery, public availability, notification recipients/categories, retention and order-reference format. Shop-sensitive changes require Manager and audit; platform-sensitive settings require Platform Admin.

### 7.9 Supplier profile

Supplier type (`EXTERNAL_PICKER` initially), legal/display name, optional business/tax identifier, contact person, mobile, email, address, payment details/reference (access-restricted), active/archive state, and internal notes. Name is required; at least one contact method is recommended. Bank/payment details must never appear in general reports or logs.

### 7.10 External berry purchase

Supplier, product, quality grade, purchase/picking date, litres (positive), effective resolved €/L buy rate and calculated total, or authorized rate/total override with reason; currency EUR, future VAT representation, payment status/date/method/reference, receipt attachment/reference, notes, creator/submitter/approver/context, and approval status. Product/supplier/grade/rate snapshots are stored at approval; mixed grades use separate lines. Manager and Platform Admin in selected-shop context see every workflow action even when they created/submitted the record.

### 7.11 Expense

Expense date, category, description, supplier/payee, gross/net/VAT values where known, currency, allocation method (`ONE_TIME`, `RECURRING`, `MANUAL_ALLOCATION`), allocation dates/rows, payment status/date/method/reference, receipt, notes, workflow status, and approver/context. Amount must be positive; allocation rows must be non-negative and sum exactly to the source amount. Manager and Platform Admin in selected-shop context see every workflow action even when they created/submitted the record.

### 7.12 Picking Entry and rate

Staff user, product, picking date, compensation method, litres, hours, rate, fixed amount, adjustment, adjustment reason, calculated earning, workflow status, submitter/approver/payment fields. Rules:

- `PER_LITRE`: litres > 0 and rate ≥ 0; hours hidden.
- `PER_HOUR`: hours > 0 and rate ≥ 0; litres remains required for production reporting but does not calculate pay.
- `FIXED`: fixed amount ≥ 0; litres remains required.
- Adjustment may be positive/negative but cannot create a negative final earning and always requires reason.
- Effective rate is suggested by staff/product/date, then snapshotted. Unauthorized users cannot override it.
- Manager and Platform Admin in selected-shop context may approve their own entry; creator/submitter/approver actions remain separate audit events.

### 7.13 Financial report filters/export

Period preset (ISO week/month/custom), start/end business date, product, staff, fulfillment method, order source, expense category, supplier, payment/approval state, value basis (gross/net where available). End must not precede start; range length may be bounded for interactive performance. Export format is CSV or PDF. PDF includes report title/formulas/summary; CSV uses stable machine-readable columns and UTF-8.

### 7.14 Invoice preview/issue

Order (read-only), seller identity/address/identifier, invoice issue/due dates, customer billing snapshot, invoice lines, delivery fee, net/VAT/gross totals where applicable, payment method/status/reference, locale, notes/terms, preview/issue/download actions. Issue requires complete configured mandatory seller and invoice fields. Invoice number is assigned only on issue; material edits after issue create a new version/correction rather than overwriting the issued snapshot.

VAT/tax fields exist in the system model but remain hidden from the MVP invoice UI/PDF until Business enables an approved tax configuration/template after obtaining qualified accounting advice where needed. That adviser is not a portal role.

### 7.15 Order source

Stable source code, localized label, category/channel, active/archive state, display order, optional provider connection, and future attribution settings. Code is immutable after use; archive replaces delete. Campaign/referrer fields may be stored on orders, but campaign reporting UI is not required.

### 7.16 Quality grade and external buy rate

Quality Grade: stable code (e.g. A/B/C/D), localized name, localized condition/acceptance description, ranking/display order, active/archive state. External Buy Rate: product, grade, optional supplier override, effective start/end, €/L, currency, notes. Dates may not overlap ambiguously for the same scope. Used grades/rates are retained through snapshots.

External Purchase lines show supplier, product, grade, litres, resolved effective rate, calculated total, and permission-controlled override/reason. Mixed grades require separate lines.

### 7.17 Inline order transition

The order-list cell displays current status and permitted next actions. Selecting a transition never bypasses validation. Simple transitions receive compact confirmation; `CUSTOMER_DECLINED`, all cancellation variants, `READY`, completion, exception, refund, payment, and delivery actions open a focused dialog for required evidence/reason. A stale order version returns a conflict and refresh prompt.

### 7.18 Order Summary PDF

Preview/download selects locale and includes shop identity, order reference/status, customer and fulfillment snapshot, items/litres/prices, delivery fee state, total/payment state, customer-appropriate notes, and generation timestamp. It has no invoice number and is clearly labeled “Order Summary” or “Order Confirmation.” Download is audited and does not automatically send a message.

### 7.19 Shop/tenant provisioning

Platform Admin-only: shop name/legal/display name, stable tenant key, public slug/host, primary Manager, locales/timezone/currency, status, branding, plan/entitlement placeholder, and support notes. Creation preview states which isolated defaults are seeded. Suspension requires reason and impact confirmation.

### 7.20 Channel connection and content composer

Connection: provider/channel type, shop account/page/phone selected from authorized provider results, display name, status/health, scopes, token expiry, webhook state, disconnect/reconnect. Secrets are never displayed after storage.

Composer: purpose (`TRANSACTIONAL`, `MARKETING`, or `SOCIAL_POST`), localized text, image/video/link, provider template/variables where required, target Page/manual Group share/WhatsApp segment or customer/order, schedule in shop timezone, preview, approval/send permission, and test-send when supported. UI shows capability/window/template/consent warnings before queueing.

### 7.21 Customer segment

Name, description, active state, and criteria for customer area, order count/date/status, product history, fulfillment method, order source, channel consent/availability, and suppression. Preview shows eligible/excluded counts and reasons. Membership is recalculated at dispatch unless deliberately snapshotted for an approved use.

### 7.22 Shared inbox

Thread list filters by channel, status, assignee, tags, linked customer/order, unread, and date. Thread view shows normalized inbound/outbound messages, timestamps/status, attachments, customer-match confidence, link/unlink actions, assignment, internal notes, and reply composer. Internal notes can never be sent.

### 7.23 Privacy/analytics preference

Public preference UI separates necessary operation from optional analytics and optional marketing. Analytics preference controls pseudonymous funnel events. The initial marketing checkbox names the shop, purpose, and WhatsApp only. Messenger or another direct-marketing channel requires separate enablement, approved channel-specific wording, and new affirmative evidence; Facebook Page publishing is not a customer direct-marketing channel. Neither optional choice is preselected or required to order.

## 8. Shop-portal status forms

Every transition dialog displays current → target status, consequences, and required fields. High-impact actions (`CUSTOMER_DECLINED`, `CANCELLED`, `CANCELLED_BY_CUSTOMER`, `REJECTED`, `NO_SHOW`, `REFUNDED`, manual overrides) require explicit reason. Refund requires amount not exceeding refundable amount, method/status, timestamp, and note.

## 9. Form security and API mapping

Each submit maps to a typed command endpoint, includes CSRF protection for browser sessions, enforces server authorization, records actor/source/IP metadata proportionately, and rejects unknown fields where practical. Sensitive data must not be placed in URLs, analytics events, or client logs.

# Architecture and Product Decision Records

Decision records document approved interpretations that change or clarify more than one requirement document. They do not replace requirement IDs; affected source requirements must be updated in the same change.

| ADR | Status | Decision |
|---|---|---|
| [ADR-0001 — Pre-implementation baseline resolutions](0001-pre-implementation-baseline-resolutions.md) | Accepted | Scope, roles, order edge cases, finance separation, i18n, stack, phase dependencies, and external gates |
| [ADR-0002 — Manager approval and product availability](0002-manager-approval-and-product-availability.md) | Accepted in part | Product-module roles and bounded planning remain; finance and Platform Admin permission limitations are superseded by ADR-0003 |
| [ADR-0003 — Owner authority and sold-out override](0003-owner-authority-and-sold-out-override.md) | Accepted | Full Manager shop authority, Platform Admin inheritance, daily manual sold-out, public presentation, and truthful reporting |
| [ADR-0004 — Google driving-distance delivery pricing](0004-google-driving-distance-delivery-pricing.md) | Accepted with production gates | Default-off shop toggle/platform kill switch, Google route distance when enabled, no-call manual fallback when disabled, and provider safeguards |

---
version: "1.0-draft"
status: "proposed"
updated: "2026-08-23"
documentType: "reference"
audience: "Product designers, frontend engineers, QA, and product owners"
---

# Metsänilo product design system

Metsänilo uses one behavioral design foundation and two deliberately different product surfaces. The Frontstore is a Finnish-first, mobile-first seasonal commerce experience. The Admin Portal is a compact operations workspace organized around harvest capacity, order lifecycle, handover, and auditability. This document defines the target system; it does not claim that the current UI already conforms to it.

## How to use this document

Use this file as the visual and interaction reference when designing, implementing, or reviewing Metsänilo UI. Business rules, authorization, validation, localization, and order invariants remain authoritative in the linked requirements and source modules.

| Scope | Source of truth |
|---|---|
| Visual hierarchy, theme boundaries, tokens, components, responsive behavior | This document |
| Field validation and business rules | [Form and field specifications](requirements/06-form-and-field-specifications.md) |
| Order and customer flows | [Business and user flows](requirements/04-business-and-user-flows.md) |
| Order status and automation | [Order lifecycle and automation](requirements/05-order-lifecycle-and-automation.md) |
| Admin permissions | [Admin roles and permissions](requirements/09-admin-portal-roles-and-permissions.md) |
| Accessibility, performance, localization, and privacy | [Non-functional requirements](requirements/10-non-functional-security-privacy.md) |
| Pilot scope | [Single-shop pilot decision](requirements/decisions/0005-v001-single-shop-pilot-scope.md) |
| Redesign release and deferred capability scope | [UI redesign scope decision](requirements/decisions/0016-ui-redesign-scope-and-deferred-capabilities.md) |

## Surface model

The product shares behavior, accessibility, semantics, and component contracts. It does not share one visual theme across every surface.

| Layer | Both surfaces | Frontstore only | Admin Portal only |
|---|---|---|---|
| Foundation | Accessibility, semantic state, focus, spacing scale, icon family, form behavior, motion rules | — | — |
| Theme | Token contract and fallback behavior | Swappable customer theme, brand media, seasonal narrative | Stable operations theme; no seasonal reskinning |
| Typography | Semantic font roles, sentence case, Finnish character support | Expressive scale with restrained weights; final family follows prototype validation | Compact hierarchy and tabular numerals |
| Layout | Responsive grid, logical order, visible next action | Mobile-first chapters and purchase path | App shell, dense workspaces, master-detail patterns |
| Components | Buttons, fields, messages, status, dialogs, disclosure, loading, empty states | Product media, package choice, pickup/date choice, order summary | Data table, queue, inspector, lifecycle, batch actions, audit diff |
| Color | Neutral chrome and shared semantic colors | Spruce brand field plus one seasonal narrative color | Neutral operational chrome plus semantic status colors |
| Content | Plain language, action-result vocabulary, accessible error recovery | Finnish-first customer copy and local pickup context | Domain language, timestamps, permissions, and audit context |

### Document ownership map

Update the narrowest section that owns a design decision. If a change affects more than one surface or module, update the shared section first and document only the specialization in the page or module section.

| Part | Owns | Update this part when |
|---|---|---|
| I. Metsänilo shared design system | Tokens, accessibility, icons, actions, fields, feedback, status, overlays, loading, and state behavior | The same meaning or interaction changes across Frontstore and Admin Portal |
| II. Frontstore shared design system | Customer theme, Finnish-first language, mobile purchase composition, product media, and public performance | A rule applies to every or most public routes |
| III. Frontstore page specifications | Home, Reserve, How it works, Reviews, About, Privacy, and public error states | One public page changes its job, hierarchy, content, or page-specific behavior |
| IV. Admin Portal shared design system | Operations theme, shell, sidebar, density, Admin language, tables, and workspace behavior | A rule applies to every or most Admin modules |
| V. Admin Portal module specifications | Overview, Orders, Availability, Reports, Products, Customers, Reviews, Settings, Users, Audit, Profile, and Auth | One module changes its workflow, lifecycle, information priority, or local actions |

Do not copy shared rules into every page or module. Page and module sections state only their job, composition, special states, responsive behavior, and exceptions from the shared contract.

## Design thesis

The Frontstore should feel like buying a known local harvest from a trusted Satakunta producer: calm, concrete, seasonal, and easy to complete with one hand. The Admin Portal should feel like a well-organized workbench: current state, risk, and next action are visible without interpretation.

The system optimizes in this order:

1. Comprehension and wayfinding.
2. Task completion and accessibility.
3. Information hierarchy and useful density.
4. Domain meaning and trust.
5. Brand coherence and visual restraint.
6. Delight.

## Part I — Metsänilo shared design system

Both surfaces use the same accessibility and behavior contract. Surface-specific tokens may change density and expression, but not meaning.

### Token architecture

Tokens use four layers so that a storefront theme can change without rewriting component behavior.

| Layer | Prefix | Purpose | May vary by surface or theme |
|---|---|---|---|
| System | `--sys-*` | Neutral ramps, type, spacing, motion, focus, semantic state | No, except documented accessibility mode |
| Surface | `--surface-*`, `--ink-*`, `--border-*` | Canvas, panels, text hierarchy, boundaries | Yes, by Frontstore/Admin root |
| Action | `--action-*` | Primary, secondary, destructive, disabled, selected | Yes, while preserving contrast and meaning |
| Component | `--control-*`, `--table-*`, `--dialog-*` | Density and component geometry | Yes, through documented variants only |

Apply tokens at explicit roots:

- `.storefront[data-theme="forest-harvest"]` owns customer-facing brand and narrative tokens.
- `.admin-app[data-theme="operations"]` owns operational density and chrome.
- Global selectors own resets, accessible defaults, shared semantic state, and no brand colors.

Do not reuse one token for unrelated roles. For example, `--action-primary` must not also define success, selected row, chart series, and a decorative border.

### Neutral and semantic palette

Neutral chrome is untinted. Semantic color always ships with text, icon, or shape so state is never communicated by hue alone.

| Token | Value | Use |
|---|---:|---|
| `--sys-white` | `#FFFFFF` | Base surface |
| `--sys-black` | `#111111` | Primary ink |
| `--ink-secondary` | `rgb(17 17 17 / 68%)` | Supporting copy |
| `--ink-operational-muted` | `rgb(17 17 17 / 56%)` | Admin timestamps and metadata that must remain readable |
| `--border-subtle` | `rgb(17 17 17 / 12%)` | Default boundary |
| `--border-strong` | `rgb(17 17 17 / 20%)` | Active grouping and control boundary |
| `--fill-hover` | `rgb(17 17 17 / 5%)` | Hover fill |
| `--fill-pressed` | `rgb(17 17 17 / 9%)` | Pressed or neutral selected fill |
| `--state-focus` | `#005FCC` | Three-pixel focus ring with offset |
| `--state-focus-inverse` | `#FFCC66` | Focus ring on dark brand or inverse surfaces |
| `--state-success` | `#18794E` | Completed, available, saved |
| `--state-warning` | `#8A5A00` | Attention, capacity near limit, unpaid |
| `--state-danger` | `#B42318` | Error, destructive, blocked |
| `--state-info` | `#175CD3` | Informational state and active process |

Validate every foreground/background pair in its rendered context. Do not apply `opacity` to a container to create muted text; use alpha color tokens on the text or icon itself.

### Typography

Typography uses semantic roles so the product can evaluate two Nordic directions without rewriting component CSS. The final family is not locked until target users complete the prototype review.

| Token | Purpose | Required behavior |
|---|---|---|
| `--font-display` | Frontstore display and major chapter headings | Finnish glyph coverage, restrained weights, no use in controls or data tables |
| `--font-ui` | Body copy, navigation, forms, buttons, and Admin UI | High legibility at `13–16px`, tabular numerals, variable or bounded weight files |
| `--font-data` | Tables, money, litres, dates, and references | Defaults to `--font-ui` with tabular numerals |

The two high-fidelity prototype directions are:

| Direction | Frontstore | Admin Portal | Palette character |
|---|---|---|---|
| A. Finnish civic harvest | Finlandica Headline for selected H1/H2 roles; Source Sans 3 for body and UI | Source Sans 3 | Snow, forest, bilberry, and restrained lingonberry |
| B. Nordic commerce utility | Inter Variable throughout | Inter Variable | White, ink, spruce, berry, and neutral gray |

Test both directions with the same realistic content and tasks. Evaluate comprehension, trust, completion time, errors, and accessibility; preference alone does not select the final direction. Use 5–8 Finnish-speaking Frontstore participants and 3–5 actual Admin operators before visual lock.

| Role | Frontstore | Admin Portal |
|---|---|---|
| Display | `clamp(2.5rem, 10vw, 4.75rem)`, 500–600, line-height `1.02`, tracking validated per chosen family | Not used |
| Page title | `clamp(2rem, 7vw, 3.5rem)`, 550 | `clamp(1.5rem, 3vw, 2rem)`, 600 |
| Section title | `clamp(1.5rem, 5vw, 2.25rem)`, 550 | `1.125rem`, 600 |
| Body | `1rem`, 400, line-height `1.55` | `0.9375rem`, 400, line-height `1.45` |
| Label/control | `0.9375rem`, 500 | `0.8125rem`, 500–600 |
| Data/meta | `0.8125rem`, 500, tabular numerals where numeric | `0.75rem`, 500, tabular numerals |

Use sentence case for navigation, labels, buttons, badges, table headers, and metadata. Preserve legal names, customer-authored text, status codes in logs, and the approved brand mark as authored. Do not use CSS uppercase transforms.

### Spacing, radius, and elevation

Use a four-pixel base with an eight-pixel primary rhythm. Density differs by surface but relationships remain consistent.

| Token | Value | Typical use |
|---|---:|---|
| `--space-1` | `4px` | Icon/label micro-gap |
| `--space-2` | `8px` | Related controls |
| `--space-3` | `12px` | Compact field and row gap |
| `--space-4` | `16px` | Default group gap |
| `--space-6` | `24px` | Panel padding and mobile page margin |
| `--space-8` | `32px` | Section grouping |
| `--space-12` | `48px` | Frontstore chapter transition on mobile |
| `--space-20` | `80px` | Frontstore chapter transition on desktop |

Use `8px` for controls, `12px` for panels, and `16px` only for large storefront media. Use full pills only for tags, compact status, filters, or a documented primary-button family. Equivalent actions use the same height, radius, padding, and weight.

Use shadows only when elevation communicates behavior: dialogs, menus, drawers, sticky action trays, and drag previews. Static cards use a boundary or surface contrast, not a default shadow.

### Responsive behavior

Mobile behavior is a distinct composition, not a scaled desktop layout.

- Use `24px` page margins at `390px` when space permits; never use less than `16px`.
- Preserve at least `44px` interactive targets in touch contexts and `8px` separation between adjacent targets. Dense Admin controls may use a `36px` visual box only on fine-pointer desktop layouts and must not become the only path to a critical action.
- Keep content in logical reading and keyboard order when columns stack.
- Do not hide an action on mobile unless an equivalent reachable action remains.
- Avoid horizontal page scrolling. Data tables may use an explicitly labeled scroll region only when column relationships cannot be transformed safely.
- Test at `320px`, `390px`, `768px`, `1024px`, and `1440px`, plus 200% text zoom.

### Iconography

Use `lucide-react` for interface iconography. Icons support a label or replace it only when the meaning is universal and an accessible name is present.

| Context | Size | Stroke | Rule |
|---|---:|---:|---|
| Inline text/status | `16px` | `1.75` | Align optically to text baseline |
| Buttons and fields | `18px` or `20px` | `1.75` | One icon maximum unless a compound control requires two |
| Empty state or illustration support | `24px` | `1.75` | Never use as decoration alone |

Do not use emoji, text arrows, Unicode stars, or hand-drawn CSS icons in application chrome. Emoji inside a review, message, or customer name remains customer content and must not be rewritten.

Maintain one icon registry that maps each action and concept to one Lucide icon. Do not choose a different icon for the same action in another module or mix outline and filled families.

- Use icon-only buttons for universal, repeated controls such as Close, More actions, Expand/collapse, Show/hide, and row-level navigation. Every icon-only button needs an accessible name and a tooltip on hover and focus.
- Keep text with consequential or less familiar actions such as Save changes, New product, Export, Reset password, Revoke access, Archive, and Delete.
- Use one leading icon at most in an ordinary button. Do not add icons to every label, field heading, KPI, or navigation group.
- Put destructive row actions inside the More menu unless immediate access is essential. An icon alone must never make an irreversible change.
- Keep brand symbols and product-category illustrations separate from interface icons. A berry illustration may identify customer content, but it must not replace a status or action icon.

### Motion

Motion communicates feedback or spatial continuity. It does not decorate static screens.

- Use `120–180ms` for hover, press, and small control feedback.
- Use `180–240ms` ease-out for menus, drawers, and dialogs.
- Animate transform and opacity; avoid layout-property animation.
- Make repeated operational actions immediate and avoid entrance animation.
- Honor `prefers-reduced-motion` and keep non-motion feedback visible.
- Gate hover-only behavior behind a fine pointer query.

### Accessibility contract

All critical Frontstore and Admin flows target WCAG 2.2 AA. Accessibility is part of the component definition, not a later review layer.

- Keep visible focus at least `3px` with an offset; use the inverse focus token on dark brand surfaces, and preserve focus through error and selected states.
- Use semantic HTML, native controls, accessible names, and explicit table headers.
- Keep labels visible. Placeholder text never replaces a label.
- Pair semantic colors with text and, when useful, an icon or shape.
- Announce asynchronous status through the appropriate live region without moving focus for routine success.
- Move focus to a submit error summary, destructive confirmation, or newly opened blocking dialog when the workflow requires it.
- Restore focus to the trigger after a dialog, drawer, or menu closes.
- Preserve logical tab order and provide a clear escape route from overlays and focused workspaces.

### Shared primitives

Shared components keep the same meaning and interaction across both surfaces. Density and theme values may vary only through documented tokens or variants.

#### Buttons and actions

Button labels describe the result and stay consistent through confirmation and feedback.

| Variant | Use | Visual weight |
|---|---|---|
| Primary | One dominant safe action in the current region | Filled brand/action color |
| Secondary | Alternative or supporting action | Neutral fill or border |
| Quiet | Low-frequency local action | Text/icon with hover fill |
| Destructive | Delete, anonymize, cancel with irreversible impact | Danger text/border; filled danger only in final confirmation |
| Disabled | Action unavailable because a condition is unmet | Legible neutral state plus nearby reason |

Use “Save changes,” “Confirm order,” and “Send reservation request,” not “Submit.” If a button says “Confirm order,” success feedback says “Order confirmed.”

Use a small, role-based size scale instead of sizing each module independently.

| Surface variant | Use | Height | Rule |
|---|---|---:|---|
| Frontstore default | Customer forms and reservation actions | `52px` | Prefer a clear text label; use full width only inside the mobile purchase flow |
| Admin compact | Dense toolbar, table row, icon-only utility | `36px` | Never use for the page primary action or on touch layouts |
| Admin default | Forms, dialogs, ordinary page and module actions | `40px` | Default fine-pointer Admin size |
| Admin prominent | One page or workflow primary action | `44px` | Use only when stronger emphasis is necessary |
| Admin touch | Any mobile Admin action | `48px` | Full width only when the action belongs to the complete region |

Apply an action budget to every region:

- Show at most one primary button in a page header, form footer, dialog footer, or record inspector.
- Show no more than two visible secondary actions beside it. Move lower-frequency actions into a labeled More menu.
- Use icon-only actions to reduce repeated chrome, not to hide unfamiliar meaning. Keep labels for creation, saving, exporting, permissions, and destructive actions.
- Give equivalent actions the same icon, label, size, order, and loading behavior across modules.
- Do not repeat an action in the page header and again in the first card or pane.

#### Form and field system

Forms share validation and accessibility behavior while using a customer or Admin density variant.

| Property | Frontstore | Admin Portal |
|---|---:|---:|
| Default control height | `52px` | `40px` desktop, `48px` mobile |
| Control radius | `8px` | `8px` |
| Label | `15px`, 500 | `13px`, 500–600 |
| Field gap | `8px` | `6px` |
| Group gap | `24px` | `16px` |
| Textarea minimum | `120px` | `104px` |

Every field supports these states:

- Rest, hover, focus, filled, invalid, disabled, read-only, and loading when the control performs a lookup.
- A visible label; optional marker in text; help text before an error; error immediately after the affected control or group.
- `aria-describedby` links for help and errors, `aria-invalid` for invalid controls, and native required semantics where appropriate.
- An error summary near the start of a submitted form. Move focus to it and provide links or a deterministic route to invalid fields.
- Normal document flow for errors. Do not use negative margins, absolute positioning, or overlapping shadows.

Use the focus ring independently from validation. An invalid focused field retains both a danger boundary and the focus ring.

Keep forms visually current by reducing containers and making state—not decoration—the dominant signal.

- Group fields with headings, spacing, and an occasional divider. Do not wrap every field group in a raised card.
- Keep labels above controls. A placeholder may show an example, but it never replaces the label.
- Match text inputs, selects, date controls, comboboxes, and textareas in height, border, radius, focus, disabled, and error behavior.
- Keep units and formats attached to the value: litres, EUR, dates, phone numbers, and percentages use a visible prefix, suffix, or format hint.
- Show required, optional, read-only, and inherited values explicitly. Do not rely on color or reduced opacity alone.
- Reveal advanced fields through a labeled disclosure, while keeping all fields that determine validity or price visible before save.
- In long Admin editors, use persistent section navigation and a sticky action bar that shows dirty, saving, saved, and conflict states.

#### Save behavior

The system autosaves low-risk personal preferences and recoverable drafts. It requires an explicit action for business facts, lifecycle changes, publication, permissions, and destructive operations.

| Data or action | Save contract |
|---|---|
| Sidebar state, density, column order/visibility, saved filters, and locale preference | Autosave immediately or optimistically; show an error only when persistence fails |
| Notification read/unread | Update optimistically and reconcile with the server |
| Storefront/media content draft | Versioned autosave after a short debounce or field blur; never auto-publish |
| Product identity, package, price, visibility, and availability window | Explicit **Save changes** |
| Capacity, sold-out state, order mutation, payment, refund, fulfillment, or delivery fee | Explicit action with impact and conflict checks |
| Customer merge/anonymization, user role, permission, and operational settings | Explicit save or confirmation |
| Theme publication, translation approval, review moderation, and legal content | Explicit preview/review and publish or approve action |

Every explicit-save editor exposes `Unsaved changes`, `Saving`, `Saved`, `Failed`, and `Conflict` states. Preserve entered values after validation, permission, session, network, or version-conflict failure. Warn before navigation when unsaved business data would be lost. Do not show a toast for every successful preference or draft autosave.

#### Destructive actions, deletion, and anonymization

Permission is necessary but never sufficient for permanent deletion. The server performs a shop-scoped dependency check and returns the allowed alternative before the UI offers a destructive action.

| Record | Permanent deletion condition | Otherwise |
|---|---|---|
| Product or package | No order, availability, season, retained report, published-content, or other historical reference | Archive or deactivate |
| Order | Only an explicitly classified test or unsubmitted Admin draft with no public/customer submission, lifecycle history, capacity movement, note, payment/refund, invoice/document, export, or audit dependency | Cancel, archive, and anonymize retained personal data according to policy |
| Customer | Empty/provisional duplicate with no order, review, consent, note, message, identity-resolution, or audit-relevant relationship | Anonymize direct identifiers and retain non-identifying business facts |

A hard-delete flow requires a dedicated high-risk permission, impact preview, typed record reference, reason, final confirmation, and immutable tombstone audit containing actor, time, reason, reference, and dependency-check result. Do not provide bulk permanent deletion for Orders or Customers. Audit records are append-only and never cascade with the deleted record.

Until Legal and Business approve purpose-specific retention periods, the UI defaults to archive or anonymize for submitted Orders and established Customers. GDPR erasure handling must distinguish removable personal data from transaction and audit facts that require retention.

#### Feedback and notifications

Choose the smallest feedback surface that matches the consequence and duration.

| Pattern | Use | Focus/announcement behavior |
|---|---|---|
| Field error | One invalid value | Associate with its control; announce when validation runs |
| Inline notice | Context or recoverable state inside a workflow | Keep in flow; use status or alert semantics |
| Page banner | Cross-section failure, stale data, permission, or system impact | Place after page header; move focus only when blocking |
| Toast | Non-critical confirmation after the changed object remains visible | Auto-dismiss only after at least 5 seconds; pause on hover/focus; never carry required recovery |
| Dialog | Confirmation or blocking decision | Trap focus, name the consequence, restore focus on close |
| Alert badge | Unread count or attention count | Pair number with an accessible label; badge is not the complete message |

Success messages state the completed action. Error messages state what failed, what remains unchanged, and what the user can do next. Never use a toast as the only evidence of an order, payment, permission, or destructive result.

#### Status system

Persisted codes remain unchanged in data and APIs. UI renders localized, human-readable labels and a stable semantic tone.

- Success: completed, confirmed, ready, paid, picked up, delivered.
- Warning: new and aging, unpaid, capacity near limit, pending fee, conflict review.
- Danger: failed, rejected, cancelled, no-show, blocked, refunded when it requires attention.
- Info: picking, out for delivery, in progress, selected operational step.
- Neutral: draft, archived, inactive, historical, or context without required action.

Do not assume one status always has one tone across every lifecycle. Document exceptions when the operator's required response changes the meaning.

#### Overlays

Dialogs, drawers, menus, and sheets use shared focus, dismissal, layering, and motion behavior.

- Use a dialog for a short decision and a drawer/inspector for record context.
- Keep destructive confirmation separate from the editable form that leads to it.
- Anchor menus and popovers to their trigger.
- Use a full-height sheet for mobile inspectors and multi-field dialogs.
- Keep the primary action visible without covering content; add bottom safe-area padding on mobile.
- Close on Escape unless the user would lose unsaved input; if so, explain the choice before discarding.

#### Loading, empty, error, and permission states

Every data surface defines all four states before it is considered complete.

| State | Required content |
|---|---|
| Loading | Stable layout placeholder or concise progress label; no fake data |
| Empty | What is empty, why it may be empty, and the next permitted action |
| Error | What failed, what remains safe, correlation ID when available, retry or recovery |
| Permission | What the viewer can see, what action is unavailable, and where to request access when applicable |

Do not use a generic centered card for every state. Keep state feedback inside the region it replaces so navigation and context remain stable.

## Part II — Frontstore shared design system

The Frontstore serves local Finnish customers first. Its primary job is to help a customer confirm what is available, choose a package and date, and send a reservation request with minimal uncertainty on mobile.

### Frontstore language

Finnish is the default Frontstore locale. English remains complete and reachable through the locale switch.

- Prefer specific local terms such as pickup place, pickup date, litres, package, and pending confirmation.
- State that payment occurs at pickup or delivery wherever the customer reviews the request.
- Do not create urgency that current capacity and dates do not support.
- Keep phone, SMS, WhatsApp, pickup, and privacy wording consistent across routes.
- Format dates, time, money, volume, phone numbers, and plural forms through locale-aware helpers.

Use reservation-request wording because the customer submission remains pending until Metsänilo confirms it.

| Context | Finnish | English |
|---|---|---|
| Navigation action | **Varaa marjoja** | **Reserve berries** |
| Page heading | **Varaa marjat** | **Reserve your berries** |
| Final action | **Lähetä varauspyyntö** | **Send reservation request** |
| Success heading | **Varauspyyntö vastaanotettu** | **Reservation request received** |
| Pending explanation | **Varausta ei ole vielä vahvistettu. Metsänilo ottaa sinuun yhteyttä vahvistaakseen saatavuuden, noudon tai toimituksen ja lopullisen hinnan.** | **Your reservation is not confirmed yet. Metsänilo will contact you to confirm availability, pickup or delivery, and the final price.** |

The Admin may retain `Order` as its internal entity name. Render `NEW` as **New request** and `CONFIRMED` as **Reservation confirmed**. Do not use **Tilaa**, **Osta**, **Order now**, or **Place order** unless the legal and business contract changes so submission creates the corresponding order or payment obligation.

### Content, media, and translation governance

Content authority is permission-based rather than tied to a role name. Admin, Manager, Staff, Content Creator, or a future role may act when assigned the required permission.

| Permission contract | Authority |
|---|---|
| `media.write` | Upload, crop, caption, describe, and maintain asset metadata |
| `cms.edit` | Edit supported Storefront/Media content drafts |
| `cms.publish` | Publish approved storefront content |
| `translation.approve` | Approve an enabled-locale translation for publication |
| `theme.manage` | Draft, preview, publish, and roll back a controlled theme |
| `legal.publish` | Publish approved legal or consumer-contract copy |

Legal publication remains separate from ordinary content publication. Before publication, every asset records source or license, author/consent where applicable, locale-specific alternative text or an explicit decorative classification, focal point/crop, lifecycle state, and usage references. The UI blocks publication when required alternative text, rights/source evidence, or enabled-locale content is missing.

### Visual direction

The target direction is **Nordic harvest utility**: white and neutral chrome, one spruce brand field, restrained berry narrative color, large purposeful product photography, compact facts, and generous but controlled chapter spacing. It should feel local and premium through materials and information, not cream tint, serif typography, decorative foliage, or artificial urgency.

The deliberate aesthetic risk is removing the current editorial serif. Metsänilo keeps warmth through real harvest photography, Finnish copy, irregular but useful media crops, and the harvest signature. This avoids the generic “warm cream plus serif” commerce template while improving mobile reading and theme portability.

### Default theme: Forest harvest

The default theme retains Metsänilo's established spruce and bilberry identity while moving interface chrome to neutral values.

| Theme token | Value | Role |
|---|---:|---|
| `--surface-canvas` | `#F7F7F2` | Page canvas |
| `--surface-panel` | `#FFFFFF` | Cards, form groups, sheets |
| `--surface-chapter` | `#EEF2EC` | Occasional chapter rhythm |
| `--ink-primary` | `#17201B` | Primary text |
| `--ink-secondary` | `rgb(23 32 27 / 68%)` | Supporting text |
| `--brand-primary` | `#14532D` | Brand field and primary action |
| `--brand-on-primary` | `#FFFFFF` | Content on brand field |
| `--theme-seasonal` | `#343A75` | Harvest band and small narrative details only |
| `--theme-media-placeholder` | `#EDEDED` | Reserved image space while media loads |

Spruce is not the success color. Bilberry is not the error, price, selected, and promotional color at the same time. Semantic state always uses the shared state tokens.

### Theme flexibility

A Frontstore theme may change brand color, seasonal narrative color, media treatment, and chapter contrast. It may not change component behavior, state meaning, control geometry, focus visibility, typography accessibility, or information order.

| Must follow the active theme | Must remain semantic or invariant |
|---|---|
| Header, canvas, section and card surfaces, footer, borders, primary/secondary actions, selected controls, form focus, navigation active state, media placeholders, trust/FAQ treatments, review chrome, and reservation receipt surfaces | Error, warning, success and destructive meaning; availability lifecycle; rating gold; external-channel brand identity; photography/content imagery; readable inverse ink and neutral scrims; control geometry, interaction behavior, copy, locale, and information order |

Every approved Frontstore theme must provide:

- Canvas, panel, and chapter surfaces.
- Primary, secondary, and inverse ink.
- Brand primary and on-brand ink.
- One optional seasonal narrative color.
- Media placeholder and neutral scrim.
- Accessible hover, pressed, focus, disabled, and semantic-state mappings.
- A product-image crop policy and fallback treatment.

The redesign ships five controlled themes that share typography, components, semantics, layout order, and accessibility behavior.

| Theme | Canvas | Brand primary | Seasonal | Character |
|---|---:|---:|---:|---|
| `forest-harvest` | `#F7F7F2` | `#14532D` | `#343A75` | Default warm Finnish harvest |
| `arctic-mist` | `#F3F7F8` | `#24596A` | `#8DAEBA` | Cool coastal blue-grey |
| `midnight-spruce` | `#101715` | `#A6C6B2` | `#D7AA63` | Dark spruce with warm seasonal light |

These are prototype seed values. Validate text, icons, controls, focus, hover, and disabled combinations before a theme becomes publishable.

Authorized users manage the active Frontstore theme from Admin Settings through `Draft → Preview → Publish`:

1. Selecting or adjusting a supported theme creates or updates a draft configuration.
2. Preview opens the draft in a new Frontstore context without changing the published customer experience.
3. Publish validates required tokens, contrast, media fallback, and enabled-locale content before changing the active shop configuration.
4. Publication records actor, version, timestamp, previous theme, and new theme; rollback republishes a previous valid version.

Use a dedicated `theme.manage` permission. Server-render the published shop theme to avoid a flash of the wrong theme. Do not expose a free-form color editor in this release.

### Signature: Harvest band

The Harvest band is the single memorable storefront element. It is a narrow information strip attached to the primary product image or purchasing block, inspired by Finnish market-crate labels and harvest notes.

The band answers up to three questions with real data:

- **Poimittu:** harvest or freshness context.
- **Nouto:** next pickup or delivery window.
- **Jäljellä:** remaining sellable volume or availability state.

The band is not a badge collection. It uses one line, one baseline, tabular numerals, and at most one seasonal-color edge. Hide any fact the system cannot support; never invent scarcity.

### Frontstore composition

The home page moves from trust to product to reservation. Available product media is the dominant anchor, and unavailable items never receive equal weight.

```text
Desktop
┌──────────────── navigation + locale ────────────────┐
│ concise promise + primary action │ harvest media    │
│ pickup/payment facts             │ Harvest band     │
└─────────────────────────────────────────────────────┘
┌──────── available product media ─┬─ purchase facts ─┐
│ real crop / package context       │ package + price  │
│                                   │ date + reserve   │
└───────────────────────────────────┴──────────────────┘
   proof and process chapters → reviews → local footer
```

```text
Mobile
┌─ brand ───────────── menu · EN ─┐
│ promise                         │
│ pickup/payment facts            │
│ [Reserve berries]               │
│ product media                   │
│ Harvest band                    │
├─────────────────────────────────┤
│ available package + price       │
│ date/fulfillment summary        │
│ [Reserve berries]               │
├─────────────────────────────────┤
│ how it works · reviews · footer │
└─────────────────────────────────┘
```

### Product and media rules

Product imagery carries the expressive color of the storefront.

- Use real berries, packages, hands, forest floor, Pori pickup, and delivery context.
- Reserve the media aspect ratio before load to prevent layout shift.
- Keep the primary product media at `4:5` or `1:1` on mobile and between `4:5` and `3:2` on desktop.
- Do not let a missing image create an empty card taller than the product facts.
- Use one neutral placeholder with product name; do not use a giant letter, plus sign, or emoji as product imagery.
- Keep text outside media unless a neutral scrim preserves contrast and the overlay improves the purchase path.
- Present future harvests as one compact availability note or disclosure, not repeated full product cards.

### Frontstore performance

Mobile design must support the public performance requirements on representative Finnish 4G.

- Prioritize the first available product image and avoid an autoplay hero carousel.
- Use responsive image sizes and modern formats.
- Do not load review galleries, maps, or below-the-fold media before needed.
- Keep the first screen useful while images load.
- Avoid layout shifts from availability, price, validation, or locale content.

## Part III — Frontstore page specifications

Each route has one job and a consistent mobile hierarchy.

| Route | Primary job | Required composition |
|---|---|---|
| `/[locale]` | Establish trust and move customers to an available product | Promise, real product media, Harvest band, packages, process, reviews |
| `/[locale]/reserve` | Complete a reservation request | Progressive form, persistent order summary, recovery from capacity/date changes |
| `/[locale]/how-it-works` | Explain reservation, confirmation, pickup/delivery, and payment | Four plain-language steps with real local details |
| `/[locale]/reviews` | Assess trust | Rating summary, verified context, readable review list; customer emoji remains content |
| `/[locale]/about` | Understand producer and locality | Specific Satakunta story, people/process photography, contact path |
| Privacy or legal information page | Understand data use | Narrow readable measure, descriptive headings, locale switch, no marketing chrome |
| Locale-aware not found | Recover from an invalid or unavailable route | Plain explanation, home link, reservation link when selling is available |

### Home

The home page helps a local customer decide whether Metsänilo is trustworthy and whether there is something available to reserve now.

| Contract | Specification |
|---|---|
| First screen | Brand promise, pickup/payment facts, one reservation action, real product media, and Harvest band |
| Product chapter | Available packages, litres, price, next eligible date, and one path into reservation |
| Supporting content | Short process explanation, selected trust proof, local producer context, and footer contact information |
| Empty or future harvest | Replace unavailable product cards with one compact seasonal notice and an optional notification/contact path |
| Mobile | Keep one dominant reservation action per viewport and show availability before long brand storytelling |

### Reserve

The reservation flow uses progressive disclosure while preserving a complete server-side form submission and accessible validation.

| Stage | Customer question | Required content | Mobile behavior |
|---|---|---|---|
| Product | What can I buy? | Available product, package, litres, price, remaining availability | Show available options first; collapse unavailable products under “Coming later” |
| Fulfillment | When and how do I receive it? | Date, pickup/delivery, location, delivery agreement | Show eligible dates as a compact list or horizontal choice group with readable full labels |
| Contact | How will Metsänilo confirm it? | Name, phone, optional email and notes | Use correct input modes and keep marketing consent separate |
| Review | What am I requesting? | Product, package, quantity, date, method, total, pending-confirmation statement | Use a sticky summary only when it does not cover fields or errors |
| Result | What happens next? | Reference, pending status, contact expectation, correction path | Replace the form with a focused confirmation; do not rely on a toast |

Use one primary submit action. SMS and WhatsApp are alternate reservation channels and must appear as secondary actions after the web path, not as competing primary buttons above the form.

### How it works

The How it works page removes uncertainty before a customer starts a reservation.

| Contract | Specification |
|---|---|
| Sequence | Choose product → send request → receive confirmation → pickup or delivery and payment |
| Content | Use real pickup locations, confirmation expectations, payment timing, and delivery constraints |
| Interaction | Keep each step directly linkable and provide one reservation action after the explanation |
| Mobile | Use a single vertical sequence; do not hide essential terms in hover, carousel, or tooltip behavior |

### Reviews

The Reviews page provides verifiable social proof without turning customer content into decorative marketing cards.

| Contract | Specification |
|---|---|
| Summary | Rating, review count, and a plain explanation of verification or source |
| List | Reviewer display identity, date, rating, review text, and relevant product or order context when permitted |
| States | Pending or rejected reviews never appear publicly; an empty public list explains that reviews are not available yet |
| Mobile | Use one readable column, preserve authored emoji as content, and avoid horizontal review carousels |

### About

The About page explains who produces the harvest, where Metsänilo operates, and how a customer can make contact.

| Contract | Specification |
|---|---|
| Story | Specific Satakunta origin, people, harvest practice, and service area; avoid generic sustainability claims |
| Media | Real people and process photography with captions where context is not obvious |
| Action | Provide contact and reservation paths without repeating the complete home-page purchase block |
| Mobile | Alternate concise story chapters and media; do not open with a decorative full-screen image |

### Privacy and legal information

Privacy and legal content prioritizes comprehension, locale consistency, and direct access over storefront promotion.

| Contract | Specification |
|---|---|
| Layout | Narrow readable measure, descriptive headings, stable anchor links, and visible updated date |
| Content | Explain collected data, purpose, retention, customer rights, contact, and applicable business identity |
| Navigation | Keep brand, locale switch, and a route back to the Frontstore; remove promotional modules |
| Mobile | Preserve heading hierarchy and link targets at 200% text zoom without horizontal scrolling |

### Not found and public errors

Public error pages keep customers in their selected locale and provide a safe next step.

| Contract | Specification |
|---|---|
| Message | State what is unavailable in plain language without technical identifiers or stack details |
| Recovery | Link to Home and to Reserve only when reservation is currently a valid next action |
| System failure | Preserve the customer's entered data where possible and distinguish retryable failure from unavailable capacity |
| Mobile | Keep the message and recovery actions within the first viewport without decorative empty space |

## Part IV — Admin Portal shared design system

The Admin Portal supports frequent, high-consequence work. Its primary job is to show what changed, what needs attention, and what the operator can safely do next.

### Visual direction

The target direction is **Nordic operations desk**: neutral canvas, white work surfaces, restrained spruce selection, semantic status color, sans-serif type, compact rows, and strong alignment. It shares the Metsänilo mark but not the storefront's seasonal canvas, editorial display type, oversized chapters, or media-led composition.

| Admin token | Value | Role |
|---|---:|---|
| `--surface-canvas` | `#F6F6F6` | Workspace background |
| `--surface-panel` | `#FFFFFF` | Table, form, inspector, dialog |
| `--surface-recessed` | `#EFEFEF` | Filters, inactive tabs, alternating rows |
| `--ink-primary` | `#111111` | Data and primary text |
| `--ink-secondary` | `rgb(17 17 17 / 68%)` | Supporting information |
| `--ink-muted` | `rgb(17 17 17 / 56%)` | Timestamps and metadata |
| `--action-primary` | `#17372B` | Primary save or lifecycle action |
| `--action-selected` | `rgb(23 55 43 / 9%)` | Selected row or navigation item |

Admin semantic states use the shared success, warning, danger, info, and focus tokens. Charts stay neutral unless color is required to distinguish real series; capacity thresholds use value, label, and shape in addition to color.

### Admin shell

The desktop shell uses a persistent navigation rail and an action-aware page header. The mobile shell uses a drawer and keeps the current module and primary action visible.

```text
Desktop
┌─ brand ─ search ─ alerts ─ account ──────────────────┐
│ rail  │ module title · scope · last update │ actions │
│       ├───────────────────────────────────────────────┤
│       │ filters / view switch / active constraints   │
│       ├───────────────────────────────────────────────┤
│       │ primary workspace             │ inspector    │
└───────┴───────────────────────────────┴──────────────┘
```

```text
Mobile
┌─ menu · module ───────── alerts ─┐
│ scope / status / primary action  │
├──────────────────────────────────┤
│ compact filters disclosure      │
│ queue or record cards           │
│ record opens full-height sheet  │
└──────────────────────────────────┘
```

#### Navigation rail specification

The left rail provides orientation, not visual personality. Keep it quiet enough that record state and the current task remain dominant.

| Property | Expanded desktop | Collapsed desktop | Mobile |
|---|---:|---:|---|
| Width | `232px` | `64px` | Drawer up to `320px` or `calc(100vw - 48px)` |
| Navigation row | `40px` high | `40×40px` target | `48px` high |
| Icon | Lucide `18px`, `1.75` stroke | Same | Lucide `20px`, `1.75` stroke |
| Label | Sentence case, one line | Tooltip on hover and focus | Sentence case, one line where possible |
| Active state | Subtle selected fill plus a `3px` start-edge marker | Start-edge marker plus selected fill | Selected fill plus current-page semantics |

Use these rail behaviors consistently:

- Keep module order stable and group by operator task: Operations, Catalog and customers, Administration.
- Do not place every icon inside its own bordered square. The icon and label form one navigation target.
- Do not use a dark filled pill as the only active signal. Set `aria-current="page"` and combine the start-edge marker, text weight, and subtle fill.
- Keep the brand and collapse control in a fixed header; allow only the module list to scroll.
- Anchor help, storefront link, and account utilities in a separate footer region that never overlaps the last navigation item.
- At `1280px`, collapse low-frequency global-header actions into an overflow menu before reducing module workspace width.
- On mobile, close the drawer after navigation, return focus to the menu trigger, and retain the current module label in the top bar.

Shell rules keep global and local actions distinct:

- Global header: command search, alerts, role/account, and storefront link.
- Navigation rail: modules only; group labels use sentence case and disappear in collapsed mode.
- Page header: module title, scope/date, freshness, permissions, and one primary action.
- Workspace toolbar: view, filters, sort, density, and batch selection.
- Inspector/drawer: record details and local actions; it must not repeat the full page header.
- Mobile: replace the rail with a drawer and inspectors with full-height sheets.

### Admin density and responsive rules

Admin density is useful when it preserves relationships and target size.

- Use `40px` default desktop controls and `48px` mobile controls. Reserve compact `36px` controls for dense toolbars and row actions; never use compact sizing for a page's primary action.
- Use `12–16px` row padding for ordinary tables; dense audit and lookup views may use `8–12px` with readable line-height.
- Keep the viewport width available to operational work; do not center every module inside a marketing-style maximum-width column.
- Keep high-frequency row actions in a consistent action menu. Show one direct next action only when the domain has a dominant safe transition.
- On mobile, transform a table into record cards only after defining column priority and preserving labels. Do not concatenate unlabeled values.
- Saved-view rails, editor tabs, and filter groups must wrap, collapse into disclosure, or use an explicitly labeled overflow menu before they exceed the viewport. A bare scrollbar or clipped label is not acceptable navigation.
- At `390px`, the first viewport must show the module identity, current scope, and primary work—not a four-card metric preamble.
- Batch action trays must reserve space or float outside the content path without covering rows, fields, or validation feedback.

Apply this support contract by module:

| Support level | Modules | Mobile requirement |
|---|---|---|
| Full task completion | Orders, Pickup terminal, Packing, Availability | Complete the primary operational workflow at `390px` without a desktop fallback |
| Responsive core tasks | Overview, Products, Customers, Reviews, Reports, Notifications | Find, inspect, triage, and complete the primary safe action; bulk work may remain desktop-optimized |
| Desktop-first editing | Settings, Users and permissions, Security and audit | Mobile remains readable and supports safe triage/simple actions; complex matrices and bulk configuration may direct the operator to a viewport of at least `1024px` with a clear explanation |

Every module must keep navigation, permission, loading, empty, error, and recovery states usable on mobile. Desktop-first never permits a broken table, clipped action, horizontal page overflow, or silent removal of a critical task.

### Tables and record lists

Tables use a predictable interaction contract across Admin modules.

- Give every table a visible title or accessible caption and an explicit empty state.
- Use one table toolbar order: search, saved view or status, secondary filters, sort, density, then export or overflow. Show active constraints directly below it.
- Keep headers visible when the table scrolls vertically; do not sticky-pin so many columns that data disappears.
- Sort only sortable columns and expose direction in text and accessibility state.
- Keep filters above the table, show active filters as removable constraints, and provide “Clear filters.”
- Keep selection in the first column and row actions in the last column.
- Use one More icon button for ordinary row actions. Show a direct labeled action only when most rows share one safe, dominant next transition.
- Clicking a row opens an inspector only when links and controls inside the row remain independently operable.
- Support keyboard row movement only when the focused row has a visible state and help is discoverable.
- Use tabular numerals and align money, litres, counts, and timestamps consistently.
- Keep pagination position stable and preserve filters, sort, page, and selection rules in the URL when practical.
- Hide pagination and rows-per-page controls when the result is empty or fits on one page.
- Prefer subtle row dividers and hover/selected states over a separate rounded card for every row. Reserve card records for the defined mobile transformation.
- On mobile, define a primary value, secondary facts, status, and next action for each record card.

### Admin language

The current Admin Portal ships in English only. Keep every Admin string externalizable so future releases can add Finnish and Vietnamese without changing domain codes, component behavior, or data contracts. Admin, Manager, or another user with `translation.approve` approves an enabled translation before publication.

- Use customer-facing labels in previews and operator labels in the workspace; do not mix them in one control.
- Render human labels for persisted status codes while keeping raw codes available in technical audit context.
- Use absolute dates when ambiguity matters. Relative age may supplement but not replace a timestamp.
- Never expose stack traces, database keys, or protected identifiers in UI errors.
- Do not display unfinished Finnish or Vietnamese resources in the locale selector. A future locale release requires complete navigation, actions, validation, status labels, empty/error states, exports, and permission terminology.

## Part V — Admin Portal module specifications

Admin modules share the shell and primitives but adapt composition to their domain and lifecycle.

| Module | Primary operator question | Default UI pattern | Domain-specific behavior |
|---|---|---|---|
| Overview | What needs my hands now? | Attention queue, lifecycle summary, capacity and payment facts | Rank exceptions before metrics; show freshness; keep automation secondary |
| Orders | Which order should move next? | Queue/table with saved views and inspector | Emphasize next valid transition, age, fulfillment date, payment, capacity conflict, and version freshness |
| Pickup terminal | Who is here and what can I hand over? | Large-target queue optimized for fast lookup | Search by reference/name/phone; show payment and pickup readiness; minimize navigation |
| Packing | What must be picked and packed? | Stage lanes or grouped work list | Group by fulfillment date, product/package, and route; preserve quantities and capacity totals |
| Manual orders | Can staff safely create this order? | Step form with persistent calculation summary | Validate capacity, source, price, delivery agreement, and historical-order differences before commit |
| Availability | How much can we promise on each date? | Day/week planner with date inspector | Show capacity, reserved, remaining, closure, version, and mutation preview; never encode load by color alone |
| Products | Is this product ready to sell in both locales? | Master-detail editor with preview | Separate identity, FI/EN copy, packages, pricing, media, season, visibility, and archive impact |
| Customers | What is the complete relationship and safe next action? | Searchable master-detail record | Group identity, contact, orders, notes, consent, merges, and privacy actions; mask unnecessary PII in lists |
| Reviews | What can be published and under which identity? | Moderation queue and preview | Keep source, order link, consent/publication identity, visibility, and feature state explicit |
| Notifications | What changed, what requires attention, and where do I act? | Persistent inbox with filterable list and detail | Preserve unread state and history; deep-link every actionable event to its permitted record or filtered workspace |
| Reports | What happened in the selected period? | Filtered figures plus drill-down table | State date basis and recognition basis; format EUR and litres consistently; make exports reproduce filters |
| Audit | Who changed what, when, and why? | Immutable event ledger with diff drawer | Keep actor, correlation ID, before/after, reason, and source; never style events as editable cards |
| Users and permissions | Who can do this? | User list plus permission matrix | Explain effective access, role inheritance, high-risk changes, deactivation, and password reset consequences |
| Settings | What shop configuration is active? | Grouped settings form with preview | Separate public identity, pickup, delivery, contact, and operational defaults; show impact before save |
| Profile and auth | Can I access the workspace safely? | Focused single-column form | Keep login neutral and concise; expose session/password state and recovery without storefront marketing |

### Authenticated audit priorities

The live modules contain useful domain compositions that should be refined rather than replaced with one generic dashboard template.

| Module | Preserve from the current UI | Required refinement |
|---|---|---|
| Overview | Lifecycle sequence and attention context | Replace the oversized editorial headline with a compact work summary; put actionable exceptions before broad metrics |
| Orders | Compact row relationships between reference, customer, fulfillment, volume, payment, and status | Prioritize saved views without a clipped horizontal rail; use labeled record cards on mobile; hide pagination when an empty result has no pages |
| Availability | Seven-day comparative planner and window totals for capacity, reserved, and remaining litres | Provide an explicit “Edit capacity” action; keep quick increments only with mutation preview, undo, and audit feedback; make historical dates quieter and non-interactive |
| Products | Master-detail workflow, bilingual copy context, sectioned editor, and storefront preview | Remove non-actionable KPI cards from the default catalog view; keep one “New product” action, a sticky save action with dirty state, and tabs that never rely on a clipped scrollbar |
| Customers | Compact relationship row, lifetime facts, and split/table view choice | Treat conflicts and consent as saved views; keep summary metrics optional; minimize PII in the list and move sensitive detail into the inspector |
| Reviews | Moderation states, publication visibility, rating context, and storefront feature state | Keep the pending queue action-first; when it is empty, offer the next relevant view and suppress meaningless pagination rather than letting score cards dominate |
| Notifications | Durable records, unread count, order links, and top-bar alert access | Add a full inbox with read/unread history, category/severity filters, deep links, pagination, and permission-correct APIs; keep the top-bar popover as a recent-alert shortcut |
| Reports | Period-first filters and separate sales, capacity, payment, and customer lenses | Show the applied range and last refresh beside every result; keep export output tied to the visible filter set and provide drill-down from every aggregate |
| Users and permissions | Roster plus effective-access context | Replace the single long permission stream with searchable domain groups, inherited-versus-override comparison, sticky user context, and a reviewed change summary before save |
| Security and audit | Immutable event table, actor/risk/category/time filters, and export options | Make summaries specific, expose correlation ID and before/after detail in a drawer, and move risk counts into a compact filter summary rather than a decorative KPI row |
| Settings | Domain grouping for identity, fulfillment, payment, channels, media, and safety | Use persistent section navigation, scoped save actions, visible dirty state, and impact text; do not turn the complete configuration surface into one uninterrupted form |

### Overview

Overview answers “What needs my attention now?” and routes the operator into the relevant module.

| Contract | Specification |
|---|---|
| Default composition | Attention queue, today's lifecycle summary, capacity pressure, payment exceptions, and data freshness |
| Priority | Rank blocked, overdue, capacity-conflicted, and payment-sensitive work before general counts |
| Actions | Link each exception to the filtered module or record; do not recreate module editing inside dashboard cards |
| Empty state | Confirm that no action is required and show the next scheduled operational window |
| Mobile | Show the top attention item and lifecycle summary before metrics; avoid a large editorial headline |

### Orders and fulfillment

Orders helps staff identify the next order to move and complete the valid lifecycle action safely.

| Contract | Specification |
|---|---|
| Default composition | Saved queue views, shared filter toolbar, compact order list, and record inspector |
| Row priority | Reference, customer, fulfillment date/method, litres, payment, current status, and next valid transition |
| Sub-workflows | Packing groups work by date/product/package; Pickup terminal optimizes fast lookup and handover; Manual order uses a validated step form with a persistent price/capacity summary |
| Safeguards | Show stale version, capacity conflict, payment consequence, audit reason, and confirmation before high-impact transitions; do not offer permanent delete for a submitted customer reservation |
| Mobile | Replace the wide table with labeled order cards and open details in a full-height inspector; keep the dominant safe transition reachable |

### Harvest availability

Harvest availability helps staff understand and change how many litres Metsänilo can promise for each date.

| Contract | Specification |
|---|---|
| Default composition | Seven-day comparison, window totals, product scope, and date inspector |
| Day facts | Capacity, reserved, remaining, closure state, historical state, and version freshness |
| Mutations | Use an explicit Edit capacity action; quick increments require preview, success feedback, audit record, and recovery from conflict |
| Batch planning | Preview every affected date and distinguish overwrite from additive change before commit |
| Mobile | Use a vertically scrollable date list with the same facts; open one date at a time and never rely on color alone |

### Reports

Reports explains what happened during an applied period and lets staff reproduce the result through drill-down or export.

| Contract | Specification |
|---|---|
| Default composition | Period and domain filters, applied-filter summary, result lens, and drill-down table |
| Lenses | Sales and fulfillment, capacity and demand, payments and refunds, and customer health |
| Data contract | State date basis, recognition basis, timezone, last refresh, EUR formatting, and litre formatting |
| Export | Export the visible filter set and identify the applied period in the file |
| Mobile | Stack filters in a disclosure and render key figures before a labeled record list; do not compress charts below legibility |

### Product Catalog

The Product Catalog has one primary job: help an operator find a product, understand whether it is ready to sell, and make a safe change. Metrics, creation, selection, editing, and publishing must not compete in the same visual tier.

```text
Desktop
┌─ Products ─ search ─ status filter ─ sort ───── New product ┐
├─ Product list ───────────┬─ Selected product · readiness ───┤
│ image · name             │ General                          │
│ selling state            │ Storefront copy                 │
│ missing requirements     │ Packages and pricing            │
│ season · package count   │ Media                            │
│                          │ Season and availability          │
│                          │ Publishing                       │
│                          ├───────────────────────────────────┤
│                          │ focused editor section           │
├──────────────────────────┴─ unsaved · Discard · Save changes┤
└──────────────────────────────────────────────────────────────┘
```

```text
Mobile list                     Mobile editor
┌─ Products ───── New ┐         ┌─ Back · Product ─ More ┐
│ search              │         │ readiness summary      │
│ status · sort       │         │ section selector       │
│ product record      │  open   │ focused fields         │
│ product record      │ ──────▶ │                       │
│ product record      │         ├─ Discard · Save ──────┤
└─────────────────────┘         └────────────────────────┘
```

Apply this workflow contract:

1. Show the catalog list first. Replace the four KPI cards with filter counts only when the counts help narrow the list.
2. Keep one visible “New product” action in the active responsive composition. Do not repeat it inside the master pane, empty state, or sticky action area.
3. Give every product one readiness state: Ready to sell, Draft, Missing Finnish copy, Missing package, Outside season, Hidden, or Archived. Show the concrete missing requirement next to the state.
4. Use one default split view on desktop. Keep a table view only if operators need bulk comparison; place that choice in a compact View menu rather than a large segmented control.
5. Use persistent section navigation instead of horizontally scrolling tabs. Mark sections that contain errors or unsaved changes.
6. Keep Finnish and English context visible on desktop, but edit one locale at a time on mobile. Never compress two language forms into narrow columns.
7. Keep the current product name, selling state, preview action, and dirty state visible while editing. Reserve the sticky primary action for “Save changes.”
8. Put Preview, Duplicate, Archive, and Delete in their appropriate hierarchy. Preview may be a quiet labeled action; Duplicate and Archive belong in the More menu; Delete appears only in a destructive section or confirmation flow.
9. After save, keep the operator in the same section, update readiness immediately, and state exactly what changed. On conflict, preserve the operator's input and offer comparison before retry.
10. On mobile, open editing as a dedicated page, not a desktop split pane compressed into a card or a long-lived modal sheet.

**AC-UI-002 — Single visible create-product action:** Given any catalog size, Product Catalog exposes exactly one visible primary **New product** action in the active responsive composition. Creating a product adds and selects the new record without replacing, hiding, or limiting existing products. With 50 or more products, search, filter, sort, and pagination or virtualization remain usable. Tests count visible interactive controls, not hidden desktop/mobile duplicates in the DOM.

### Customers

Customers gives staff a complete but privacy-conscious view of the relationship and its next safe action.

| Contract | Specification |
|---|---|
| Default composition | Searchable customer list and inspector with identity, contact, orders, notes, consent, and lifetime facts |
| List priority | Name, safe contact hint, last order, order count, lifetime litres/value, and attention state; mask unnecessary PII |
| Actions | Edit details, add note, open order history, resolve duplicates, update consent with authority, and start privacy actions |
| Safeguards | Explain merge survivor, anonymization scope, consent source, dependency-check result, retention boundary, and irreversible consequences before commit; hard delete appears only for an empty provisional duplicate |
| Mobile | Use a customer record list and dedicated detail sections; never expose the full profile in a compressed row |

### Review moderation

Review moderation helps staff decide what may be published, under which identity, and whether it may be featured.

| Contract | Specification |
|---|---|
| Default composition | Pending queue, saved moderation views, search, review detail, and storefront preview |
| Review facts | Source, rating, authored text, order link when permitted, consent, publication identity, moderation state, and feature state |
| Actions | Approve, reject with reason, change publication identity, feature, unfeature, and edit only under documented policy |
| Empty state | If Pending is empty, confirm completion and link to the next relevant non-empty view; hide meaningless pagination |
| Mobile | Keep authored text readable and move moderation actions into a sticky decision footer without covering content |

### Notifications

Notifications provides an authoritative operational inbox. The top-bar alert popover remains a shortcut to recent unread events, not the only place where history exists.

| Contract | Specification |
|---|---|
| Default composition | Unread-first inbox, search, category/severity/state filters, time grouping, and detail inspector |
| List facts | Title, concise event summary, category, severity, created time, read state, and related record when permitted |
| Actions | Mark read/unread, mark the current filtered set read after confirmation, open related record, and return to the same filter/scroll position |
| History | Read events remain available through filters and pagination; do not delete an event when the operator marks it read |
| Deep links | Link to a permitted record or filtered workspace. If the target no longer exists or access changed, explain the state without exposing protected data |
| Empty state | Distinguish “No unread notifications” from “No notifications match these filters” and offer the relevant reset or All view |
| Mobile | Use a labeled event list and full-height detail sheet; preserve filters and unread state across navigation |

Inbox access uses `notifications.read`. A future notification-management permission may control preferences or operational policy, but reading and marking a notification must not depend on unrelated Orders write permissions. Every category defines severity, deduplication, actor/recipient scope, deep-link target, retention, and escalation behavior before implementation.

### Settings

Settings shows the active shop configuration and the impact of changing it.

| Contract | Specification |
|---|---|
| Sections | Identity and legal details, fulfillment hubs, payment guidance, order channels, storefront and media, Frontstore themes, and system safety |
| Navigation | Use persistent section navigation with search when the setting count grows; keep one focused section in view |
| Save behavior | Scope save actions to the current section and show dirty, saving, saved, error, permission, and conflict states |
| Impact | Explain which public pages, messages, fulfillment rules, or future orders the change affects |
| Frontstore and media | Refine the settings and media workflow that already exists; this release does not add a fixed-page CMS, arbitrary page editor, or revision/restore system |
| Theme publishing | Use `Draft → Preview → Publish`, show the current published version, validate enabled locales and theme tokens, audit publication, and provide rollback |
| Mobile | Use a section index followed by a dedicated section page; do not render the entire settings catalog as one continuous form |

### Users and permissions

Users and permissions explains who has access, why they have it, and what a proposed change will alter.

| Contract | Specification |
|---|---|
| Default composition | Team roster, selected user summary, effective-access summary, and searchable permission groups |
| Access model | Distinguish role defaults, explicit grants, explicit revocations, and final effective permission |
| Changes | Review the before/after permission diff and high-risk consequences before saving |
| Account actions | Keep onboarding, role change, password reset, session revocation, suspension, and deactivation distinct |
| Mobile | Open a selected user on a dedicated page; keep identity and effective role visible while permission groups expand |

### Security and audit

Security and audit provides an immutable explanation of who changed what, when, from where, and why.

| Contract | Specification |
|---|---|
| Default composition | Search and risk/category/actor/time filters, applied constraints, immutable event table, and diff inspector |
| Event facts | Timestamp, actor, source, severity, action, target, specific summary, reason, correlation ID, and before/after values |
| Actions | Filter, inspect, copy permitted identifiers, open related records, and export; events themselves are never editable |
| Risk summary | Use compact counts as filters rather than a decorative four-card preamble |
| Mobile | Render an event list with timestamp, actor, action, target, and severity; open full forensic detail in a sheet |

### Profile and authentication

Profile and authentication keeps account access focused, neutral, and separate from operational modules.

| Contract | Specification |
|---|---|
| Login | One concise form with visible labels, password visibility control, recovery guidance, and clear failure state |
| Password change | State password requirements before entry, confirm success, and explain session consequences |
| Profile | Show editable personal fields, role as read-only context, and active-session access when permitted |
| Permission state | Redirect or explain unavailable Admin access without exposing protected navigation or data |
| Mobile | Use a single-column layout with full-width fields and actions; never inherit the dense operations table treatment |

## Implementation boundaries

The design system should become easier to change than the current global stylesheet.

The redesign release uses actual implementation status instead of treating every named capability as complete.

| Capability | Current status | Redesign decision |
|---|---|---|
| Storefront and media settings | Partial | Refine the existing Settings/media workflow; do not add full fixed-page CMS revisions in this release |
| Order packing/picking workflow | Implemented with UI gaps | Redesign the existing order fulfillment workflow; do not add independent picker production or earnings records |
| Notifications | Partial | Keep durable notifications and recent-alert popover; add a filterable inbox with read/unread, deep links, and history |
| Frontstore themes | Missing | Add five controlled themes and Admin `Draft → Preview → Publish` management |
| MFA | Missing | Excluded from UI redesign and assigned to a separate security-hardening decision; it remains a production security gate unless a later risk decision changes that gate |
| Invoice and Order Summary documents | Missing | Excluded from UI redesign and retained for a later finance/document release |
| Admin Finnish and Vietnamese | Missing | Keep Admin English-only now and preserve externalizable resources for a later i18n release |

Current deletion behavior requires correction before the redesigned destructive UI may expose it:

- Product deletion already checks Orders and Availability and uses `catalog.product.delete`, but audit attribution is hard-coded and the dependency check must cover every retained reference.
- Order deletion already uses `orders.delete` and writes an audit event, but its current payment-only gate can delete active/post-picking history and related notes/payment rows. The redesigned UI must not normalize or expose this behavior as safe.
- Customer hard delete does not exist. Anonymization exists, but the API must enforce `customers.anonymize` rather than a broader write permission and must collect a reason and impact confirmation.
- An audit row proves that an action was recorded; it does not by itself prove correct permission, actor attribution, dependency safety, or retention compliance.

Use these ownership boundaries during implementation:

| Owner | Responsibility |
|---|---|
| Foundation styles | Reset, typography, spacing, focus, semantic state, shared component behavior |
| Frontstore theme | Brand, narrative color, customer density, chapter and media composition |
| Admin theme | Operational canvas, density, shell, tables, inspectors, status application |
| Module styles | Domain layout only; no new raw state colors, focus, field, button, or dialog behavior |
| React primitives | Accessibility, state contract, variants, and reusable interaction behavior |

Prefer source-level separation over a growing override layer. Split tokens when a value serves two meanings; do not choose a compromise value that is wrong for both.

## Verification and acceptance

A redesigned surface is complete only after mechanical and visual verification.

### Required viewport review

Review realistic Finnish and English content at these viewport targets.

| Surface | Required viewports |
|---|---|
| Frontstore | `320×700`, `390×844`, `768×1024`, `1440×900` |
| Admin Portal | `390×844`, `768×1024`, `1280×720`, `1440×900` |

At each target, verify the primary task, next action, navigation, overflow, wrapping, touch targets, focus, semantic states, and content order. Give mobile its own review; do not treat it as a desktop screenshot at a smaller width.

### Required component states

Visual tests and Storybook stories must cover the following states for every relevant primitive and module.

- Rest, hover, pressed, keyboard focus, disabled, and loading controls.
- Empty, error, success, warning, stale/conflict, and permission-limited data states.
- Long Finnish strings, English strings, long names, large currency values, zero results, and dense results.
- Dialog open/close, focus restore, Escape, destructive confirmation, and reduced motion.
- Mobile table/card transformation, sticky action behavior, safe-area padding, and 200% text zoom.
- Theme contract tests proving that a Frontstore theme changes appearance without changing semantics or layout behavior.

### Release checks

Run the repository's normal verification commands after implementation changes:

1. Run `npm run typecheck`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
5. Render the changed routes and Storybook states at required viewports.
6. Inspect browser console errors, horizontal overflow, keyboard order, and focus styling.

## Migration sequence

Implement the redesign in layers so visual work does not weaken order, capacity, permission, or validation behavior.

| Phase | Scope | Exit condition |
|---|---|---|
| 1. Inventory and contract | Map current token consumers, raw colors, component states, stories, routes, capability status, and destructive paths | Every existing visual role has a target semantic token or explicit exception; unsafe current behavior is recorded rather than copied |
| 2. Prototype validation | Test Finnish civic harvest and Nordic commerce utility on the same Frontstore/Admin tasks | Target participants select a direction through comprehension, trust, completion, error, and accessibility evidence |
| 3. Shared foundation | Add type roles, spacing, focus, icon, button, field, feedback, status, save, deletion, overlay, and table contracts | Foundation Storybook gallery passes all states without storefront/Admin brand coupling |
| 4. Theme separation | Create Frontstore and Admin roots, five controlled theme configurations, and publishing versions | Preview never changes the published theme; switching Frontstore theme cannot restyle Admin |
| 5. Frontstore mobile path | Redesign navigation, home product block, reservation flow, result, footer, and FI/EN switching | A customer can send a valid reservation at `390px` in either locale without overflow or competing primary actions |
| 6. Admin shell | Redesign login, header, rail/drawer, page header, toolbar, inspector, action tray | Global and module actions remain clear at desktop and mobile sizes |
| 7. Priority Admin modules | Redesign Orders, Pickup, Packing, and Availability for full mobile task completion | Each primary operational workflow completes at `390px` and preserves domain/audit safeguards |
| 8. Remaining Admin modules | Apply domain patterns to Products, Customers, Reviews, Reports, Notifications, Settings, Users, and Audit | Notification history/deep links work; every module covers loading, empty, error, permission, conflict, and success states |
| 9. Hardening | Remove obsolete styles, repair stories, run visual/accessibility/performance checks | No uncontrolled raw UI tokens, broken stories, console errors, or known critical-state gaps |

Do not migrate by replacing every token globally in one change. Inspect each consumer first, especially colors currently shared by brand, status, selection, border, and feedback roles.

## Decisions and open questions

This section records product decisions that define the redesign release and the remaining external approvals that cannot be resolved through UI design.

### Established by this design brief

The following decisions are ready to guide implementation.

- Frontstore is Finnish-first and mobile-first.
- Frontstore supports a controlled theme contract.
- Admin uses a stable modern operations theme, not the active seasonal storefront theme.
- Both surfaces share behavior, semantics, accessibility, form rules, notifications, icons, and component contracts.
- Admin modules use domain-specific composition and workflow behavior inside one coherent shell.
- Lucide is the only interface icon family.
- Neutral chrome and real media replace decorative gradients, emoji chrome, and repeated generic cards.
- The Frontstore defaults to Finnish and retains a complete English locale switch.
- The Admin ships in English only; Finnish and Vietnamese Admin localization remain future work.
- Orders, Pickup, Packing, and Availability provide full mobile task completion. Settings and Users remain desktop-first while preserving a safe mobile baseline.
- The redesign refines existing Storefront/Media settings and order packing. It does not add a fixed-page CMS or independent picker records.
- Notifications expands from the existing popover into an inbox with filters, read/unread, deep links, and retained history.
- Frontstore theme publication uses five controlled themes and `Draft → Preview → Publish` with version, audit, and rollback.
- Reservation-request wording is canonical in Finnish and English.
- Preferences and versioned drafts may autosave. Business mutations, publication, permissions, and destructive actions require explicit save or confirmation.
- Permanent deletion remains conditional on a server-side dependency check, dedicated permission, impact preview, reason, confirmation, and tombstone audit.
- MFA and Invoice are not part of the UI redesign release. They remain recorded future capabilities under the redesign scope ADR.

### External approvals still required

These approvals do not change the visual direction, but they gate the affected production behavior.

| Decision | Current design default | Required approval |
|---|---|---|
| Final typography/palette | Test Direction A and B; do not lock the final family before target-user validation | Product owner accepts the prototype evidence |
| Photography, logo, alt text, legal copy, and storefront content | Any user may work on an asset when assigned the relevant granular permission | Admin/Manager or another explicitly permissioned approver publishes; Legal/Business approves legal copy |
| Data retention | Archive/anonymize submitted business records and block unsafe hard delete | Legal/Business approves purpose-specific durations and deletion/anonymization rules |
| Consumer contract wording | Submission creates a pending reservation request, not a confirmed order | Finnish legal review confirms contract formation, cancellation, and required disclosures |
| Dark mode | Out of scope | A later product decision must fund the additional semantic and verification surface |

## Appendix — Audit baseline

## Shared confirmation dialog system

All confirmation actions across Admin Portal and any authenticated/operational surface use the shared confirmation contract rather than the browser-native `window.confirm` or a one-off modal.

- **Anatomy:** eyebrow identifies the action family; title states the decision in plain language; description explains the immediate consequence; optional children contain only the minimum impact/reason field; footer keeps Cancel secondary and the action-specific confirm label primary.
- **Variants:** default for reversible workflow actions; warning for actions with operational impact; destructive for archive, anonymize, revoke, or conditional permanent delete. Destructive actions must name the record and consequence, and require the permission/dependency rules enforced by the server.
- **Behavior:** `role="alertdialog"`, `aria-modal`, labelled title/description, initial focus on the safe Cancel action, Escape and backdrop dismiss when not busy, focus trap while open, focus return to the invoking control, and disabled actions with a progress label during mutation.
- **Copy:** use the verb that will happen (`Publish theme`, `Archive product`, `Revoke sessions`, `Confirm pickup`) rather than generic `OK` or `Confirm`. Do not introduce a second confirmation after the dialog unless the risk or dependency result changed.
- **Responsive rules:** one-column bottom sheet presentation on narrow screens, full-width action buttons when needed, minimum 44px touch targets, and no horizontally clipped content.
- **Migration rule:** new confirmations must use `AdminConfirmDialog`; existing direct `window.confirm` and bespoke confirmation markup are migration targets and should be replaced module-by-module without changing domain authorization or audit behavior.

The current product has a recognizable local identity and several sound primitives, but it needs structural redesign before a full theme refresh. The main issue is not a single color or component; storefront storytelling, Admin operations, and shared behaviors are coupled inside one expanding style layer.

### Necessary corrections

The following findings are implementation priorities, ordered by impact.

| Priority | Current condition | Target | Why it matters |
|---|---|---|---|
| Critical | [`src/app/globals.css`](src/app/globals.css) contains storefront, forms, Admin shell, module styles, duplicate `--ops-*` and `--admin-*` aliases, and many raw values in one file of about 1,790 lines. | Separate foundation, Frontstore theme, Admin theme, and module composition layers. | A theme cannot be replaced safely while tokens have mixed roles and uncontrolled consumers. |
| Critical | The mobile storefront repeats the primary reservation action in the hero, gives unavailable placeholders large visual weight, and creates a long purchase path before customer details. | One primary action per viewport, available products first, unavailable products collapsed, and progressive disclosure in the reservation flow. | Local customers must be able to understand availability and order quickly on a phone. |
| Critical | At `390px`, the authenticated Orders workspace keeps its desktop table while quick views, filter controls, and columns clip or require unlabeled horizontal scrolling. Product catalog filters also clip and the detail workflow disappears below a KPI-first composition. | Define a mobile composition for every Admin module: prioritized saved views, compact filter disclosure, labeled record cards, and either a full-height inspector sheet or dedicated page for long editing workflows. | The mobile shell exists, but the primary operational tasks are not yet reliably usable on a phone. |
| High | The Admin overview and foundation use large serif editorial headings, cream canvas, oversized chapter spacing, and storefront-like cards. | Use a sans-serif operational hierarchy, neutral canvas, higher information density, and next-action-first layouts. | Staff should read the Admin as a workspace, not as a marketing page. |
| High | Product Catalog presents four KPI cards, two view modes, duplicated “New product” actions, a master list, horizontal editor tabs, and a dense bilingual form before it establishes the operator's next task. | Make the catalog list the entry point, keep one create action, show sell-readiness on each product, and open one focused editor with persistent navigation and save state. | Operators cannot build a reliable mental model when summary, navigation, creation, selection, and editing compete at the same level. |
| High | Orders quick views and Product editor tabs overflow at ordinary desktop widths, while oversized page titles and repeated action bands reduce workspace width. | Keep page titles compact, prioritize secondary navigation, and move lower-frequency destinations into a labeled overflow menu before clipping occurs. | A `1280px` desktop must support the core task without hidden labels or accidental horizontal scrolling. |
| High | Products, Customers, Reviews, Audit, and Users lead with four-card metric strips even when the values are not actionable or the dataset contains one record. | Keep only metrics that change the operator's next decision; convert the rest to saved views, filter counts, or a compact summary line. | Operational hierarchy should follow urgency and work, not dashboard decoration. |
| High | Lucide icons, emoji, text arrows, typographic symbols, and CSS-drawn marks are mixed in interface chrome. | Use Lucide only for interface actions and status support; keep emoji only when it is customer-authored content. | A single icon grammar improves recognition, alignment, and accessibility. |
| High | The Admin sidebar uses heavy boxed icon treatments, uppercase group labels, generous spacing, and a utility block that competes with module navigation. | Use a quiet, fixed-width navigation rail with one active marker, sentence-case labels, aligned Lucide icons, and utilities anchored separately from modules. | Persistent navigation should disappear into the workflow until the operator needs it. |
| High | Buttons vary in height, radius, weight, icon grammar, and placement; multiple large actions often compete in the same region. | Apply one size scale and one action hierarchy; allow icon-only controls only for universal repeated actions with tooltips and accessible names. | Repetition and inconsistent emphasis make every action feel equally important and slow recognition. |
| High | Forms and tables rely on nested cards, all-caps labels, decorative icons, wide control spacing, and desktop tables that do not transform on mobile. | Use compact field groups, visible state behavior, a shared filter toolbar, consistent row anatomy, and explicit mobile record-card priorities. | Operators need predictable editing and scanning behavior across every module. |
| High | Uppercase labels, letter-spaced eyebrows, pill controls, radii, raw status colors, and feedback patterns vary by module. | Use sentence case, semantic tokens, a restrained radius system, and shared state components. | Operators should not have to relearn behavior between modules. |
| High | Some Storybook module stories fail without an App Router provider. | Make every shared and module-level story render in isolation with required providers. | Visual regression and state review are incomplete while key stories cannot render. |
| Medium | Cards and borders often repeat grouping already communicated by spacing. Floating selection controls can overlap content. | Use fewer containers, preserve dense table boundaries, and reserve elevation for real overlays. | Visual quiet should improve comprehension without hiding operational density. |
| Medium | The current palette is documented as a single warm editorial theme even though Admin already has separate operational aliases. | Define a stable shared semantic layer, a swappable Frontstore theme layer, and one Admin operations layer. | The requested theme flexibility needs explicit boundaries rather than more aliases. |

### Preserve

The redesign should retain the parts that already carry product meaning.

- Keep Finnish routes, `fi-FI` price and date formatting, and the English locale switch.
- Keep real availability, package price, volume, pickup, payment, and confirmation terms close to the purchase action.
- Keep the existing Metsänilo mark and its spruce identity; render the wordmark as an asset or natural-case text rather than styled uppercase UI copy.
- Keep the Lucide dependency and expand it into the only interface icon family.
- Keep shared field validation behavior, error summaries, visible labels, and minimum touch-target requirements.
- Keep permission-aware UI, stable status codes, audit trails, version conflicts, and destructive confirmation requirements.
- Keep the Admin lifecycle concept from message to crate to handover, but redesign its density and typography.
- Keep the compact Orders row relationships, Availability seven-day comparison and period summary, Reports period-first filters, and master-detail structure in Products, Customers, and Users.
- Keep expressive color in product photography and customer-authored review content.

### Verdict

The product **needs structural redesign**. A token-only recolor would preserve the current coupling, mobile friction, and storefront/Admin identity conflict.

### Audit evidence and limitations

The audit combined source inspection with rendered UI review. Source inspection covered the global style layer, public layouts and reservation flow, Admin shell and primitives, module stories, and relevant requirements. Visual inspection covered `/fi` on desktop and mobile, `/fi/reserve`, `/admin/login`, and the Admin Overview and Foundation Storybook stories.

A read-only authenticated review with the Admin role additionally covered Overview, Orders with a populated row, Availability, Products, Customers, Reviews, Reports, Settings, Users and permissions, and Security and audit. Orders and Products were also inspected at a `390px` mobile viewport; the authenticated modules were inspected at `1280px` or `1440px` desktop widths. The review did not submit forms, change statuses, export data, or trigger any other mutation.

The inspected shop has a small dataset, and only the full Admin role was available. Empty, loading, populated, and ordinary filter states were visible, but limited-role permission states, destructive confirmations, concurrency conflicts, and most failure paths were not exercised. The Orders and Availability Storybook stories still failed because their App Router provider was missing; this remains a visual-regression coverage gap even though the live modules were reviewed.

### Optional polish

Apply these refinements only after hierarchy, responsive behavior, shared states, and real imagery are complete.

- Add a restrained press response to the Frontstore primary action.
- Use one editorial-scale harvest photograph as a chapter break on the About or home page.
- Add a controlled Frontstore theme preview after the theme contract and rollback behavior exist.
- Refine Admin keyboard shortcut discovery after the pointer and touch workflows are complete.

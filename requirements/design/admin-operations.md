# METSÄNILO Operations — Admin UI Extension

This document extends the shared brand system in [`DESIGN.md`](../../DESIGN.md) for the internal operations portal. It does not replace the shared brand tokens, customer-site identity, domain logic, or API contracts.

## Product role

METSÄNILO Operations is an order and fulfillment workspace with supporting customer, catalog, availability, payment, and access-management modules. Orders and fulfillment are the primary workflow; customer records are supporting context rather than a standalone CRM experience.

## Shared brand constraints

- Use the shared forest green, warm canvas, paper surface, bilberry accent, line, focus, success, error, and form tokens from `DESIGN.md`.
- Keep the three-leaf METSÄNILO mark consistent with the storefront.
- Use the shared humanist sans-serif for navigation, data, labels, controls, and status text.
- Reserve the editorial serif for small page accents only; admin pages must be sans-serif-first and operationally scannable.
- Do not introduce a separate brand palette, logo, icon family, or unrelated theme.

## Shell

- The shell consists of a persistent sidebar on desktop, a compact top bar, and a drawer navigation on mobile.
- The product name is **METSÄNILO Operations**.
- Navigation is grouped as Operations, Catalog & customers, and Administration.
- The active route must be visible through background, text, and icon treatment—not color alone.
- Profile, change password, storefront link, and logout belong in the user menu. Logout is the final destructive action and is visually separated.
- Every navigation target has a minimum 44px touch area; mobile menu links target 48px or more.

## Page structure

- Every module starts with a compact page header: eyebrow or section label, title, one-line purpose, and optional primary action.
- Prefer one clear primary action per page. Secondary actions use a quieter treatment or an overflow menu.
- Operational pages should prioritize readable tables, filters, status badges, and exception states over decorative cards.
- Detail views should use a main information column and a contextual action/summary column when the viewport allows it.

## Data and status language

- Status is always communicated with text plus color or shape.
- Use forest/success for available and completed, moss/amber for attention, berry/error for destructive or failed states, and neutral line/surface treatments for inactive states.
- Keep dates, quantities, prices, fulfillment method, and customer contact information immediately scannable.
- Loading, empty, error, and permission-denied states are first-class layouts, not browser-default messages.

## Responsive behavior

- Desktop: sidebar plus content workspace; content max-width follows the shared layout constraint.
- Tablet: preserve sidebar where space allows; otherwise collapse it without hiding the current module.
- Mobile: drawer navigation, stacked page headers, cards instead of wide data tables, and full-width primary actions.
- Never introduce horizontal scrolling for core order, customer, availability, or catalog workflows.

## Forms and validation

- Admin forms use the shared form primitives and states from `DESIGN.md` and `src/app/globals.css`; they do not maintain a separate validation theme.
- The admin portal may select the compact density variant (44px controls and 11px corners) through form token overrides on `.admin-app`. Customer-facing validation colors, focus treatment, error summaries, and inline-error spacing remain unchanged.
- Labels stay visible above or beside controls. Placeholder-only fields are not permitted in new admin UI.
- Inline errors follow their control or control group in normal document flow. Error summaries appear near the form start and receive focus after a failed submit.
- Bare legacy controls inside `.admin-app` inherit the shared control states. New work should use `.form-field` or `.field` and `.form-control` explicitly so label, help, error, and accessibility relationships are clear.

## Accessibility

- Maintain visible focus rings from the shared design system.
- Use semantic headings, landmarks, labels, and live regions for async feedback.
- Do not rely on color alone for status, permission, sold-out, or validation states.
- Keep text and controls readable at the senior-friendly contrast and touch-target standards used by the storefront.

## Whole-portal redesign contract

The admin redesign is delivered incrementally through Storybook-reviewed module PRs merged into the `feature/admin-portal-redesign` integration branch. Module PRs must not target `main` directly. The integration branch is the reviewable whole-portal candidate; it is merged to `main` only after every authenticated module has passed the shared acceptance checklist.

The production shell is single-source: `AdminRouteFrame` owns the authenticated frame, `AdminNavigation` owns permission-filtered navigation, and modules provide workspace content. A design prototype may use fixture data in Storybook, but no fixture-based workbench may replace a live route. The Overview route must consume the dashboard API/domain view model before it is considered migrated.

The canonical module order is: Overview, Orders, Availability, Products, Customers, Manual Orders, Reviews, Users, Settings, Audit, and Auth/Profile. Each module preserves its current route, permission, API, domain transaction, audit, localization, and shop-scoping contracts while its presentation changes.

Every redesigned module must provide Storybook coverage for its default, loading, empty, error, permission-limited, mutation-failure, mobile, keyboard-focus, and reduced-motion states where those states apply. Stories use typed fixtures that mirror the route view model; they must not fetch a database or encode production customer data.

The migration sequence is: design contract, shared tokens and primitives, production shell, Overview, Orders, Availability, Products and Customers, Manual Orders and Reviews, Users/Settings/Audit/Auth, then hardening and cutover. A later phase may consume shared components from an earlier phase, but it must not bypass the earlier phase's acceptance criteria.

The final integration review must verify every admin route at desktop, tablet, and mobile widths; keyboard-only navigation; visible focus; reduced motion; permission variants; error recovery; mutation feedback; and real data in Overview. The final PR from `feature/admin-portal-redesign` to `main` must include the Storybook build, typecheck, tests, production build result, and a list of any unresolved lint or accessibility issues.

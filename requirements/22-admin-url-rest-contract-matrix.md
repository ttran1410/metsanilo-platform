# Admin URL and REST Contract Matrix

Status: active implementation audit (2026-08-28)

This matrix is the review baseline for making admin workspaces shareable, reloadable, and observable in browser network tools. It separates application URL state from Next.js `_rsc` transport parameters.

## Contract rules

- URL is the source of truth for shareable filters, selection, tab, view mode, and pagination.
- Data filters are serialized to the module JSON API.
- Presentation state is restored by the workspace and is not sent to the database query unless the API explicitly needs it.
- Transient notice/selection parameters are consumed once and then removed or preserved only when navigation requires them.
- Sensitive values such as private tokens, credentials, and unnecessary personal data must not be placed in URLs.
- Collection reads use `GET /api/admin/<resource>`; member reads use `GET /api/admin/<resource>/<id>`.
- Named workflow endpoints remain explicit for irreversible or domain-specific actions such as refund, publish, rollback, batch archive, and batch delete.
- Every JSON endpoint uses the standard success/error envelope and permission boundary.

## Initial module matrix

| Module | Current URL state | API/query state | Main audit concern | Migration order |
| --- | --- | --- | --- | --- |
| Orders | `view`, `mode`, `q`, `from`, `to`, `preset`, `method`, `status`, `source`, `entry`, pagination | `q`, date range, method, status, source, entry, archive, triage/unpaid, pagination | Preserve all state and keep RSC `_rsc` separate; complete `created`/pagination behavior | 1 |
| Customers | `customer`, `q`, `filter`, `sort`, `view` | Search/filter/sort and selected customer | Initial server data and client state need one canonical parser | 2 |
| Users | `user`, `q`, `role`, view state | Search/role/page | Align selected user and permission action responses | 3 |
| Products | `product`, `q`, `status`, `tab`, `view` | Search/status/page where supported | Product detail and list currently mix server initial data with client workspace state | 4 |
| Reviews | `q`, `status`, `page` | Search/status/page | Verify list API response metadata and moderation action refresh | 5 |
| Availability | `view`, `productId`, `seasonId` | Product/season/date filters | Distinguish planner presentation state from capacity query | 6 |
| Audit | `audit`, `q`/`search`, `severity`, `category`, `actor`, `dateRange`, `page` | Same filters | Duplicate `q`/`search` naming and export response distinction | 7 |
| Notifications | URL state is partial | Read/unread and selected notification | Define selected item and unread mutation refresh semantics | 8 |
| Settings | Mostly local tab/form state | Resource-specific settings endpoints | Review endpoint resource naming and mutation action boundaries | 9 |

## Orders acceptance gate

## Current implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Orders | Implemented | JSON collection loader, canonical filter forwarding, transient `created` handling, stale-request protection. |
| Customers | Partially implemented | JSON/action contracts exist; URL and compatibility parity still needs endpoint-by-endpoint verification. |
| Users | Implemented for current workspace | URL state and action controllers are separated; authenticated route coverage remains incomplete. |
| Products | Partially implemented | JSON list/detail loaders and action controllers exist; package/season compatibility paths remain under audit. |
| Reviews | Implemented for current workflows | Page uses the JSON list loader; query/action modules exist and dynamic PATCH permissions are isolated. Full endpoint/browser coverage remains. |
| Availability | Implemented for current workflows | Typed action wrappers and URL state exist; browser verification remains. |
| Audit | Partially implemented | URL state and JSON loading exist; export intentionally remains a file response. |
| Notifications | Implemented for current workflows | Query and mutation paths use Admin action modules; URL state needs completeness review. |
| Settings | Compatibility preserved | Canonical resource routes and legacy collection adapters share contracts; compatibility tests are still being expanded. |

The next audit pass must record, for each module, the exact mapping between URL parameters and API parameters. `_rsc` remains excluded from all application contracts, and `created` remains transient rather than a persistent data filter.

Orders is the reference implementation. It is ready to serve as the template when:

1. Reloading a shared URL restores the same UI state.
2. The list JSON request contains the same data filters represented in the URL.
3. `mode` and other presentation parameters do not accidentally alter database filtering.
4. Older requests cannot overwrite newer filter results.
5. API responses expose stable pagination and quick-view metadata.
6. Detail, queue, export, preview, and mutation endpoints use the typed Admin contract.
7. Browser tests cover reload, share, back/forward, API failure, retry, and rapid filter changes.

## Explicit non-goals

- Do not expose `_rsc` as an application parameter.
- Do not force CSV exports or file downloads into JSON envelopes.
- Do not rename every endpoint before its UI contract and domain ownership are understood.
- Do not move authorization into the browser while moving data loading to JSON.

## Settings/operational REST audit findings

- Fulfillment locations already have a resource-shaped collection/member pair, but the collection `PATCH`/`DELETE` compatibility operations duplicate the member routes. Keep them temporarily for compatibility, but make the member routes canonical and test both paths against the same action contract.
- Payment methods expose member routes while the collection also accepts `PUT`/`DELETE` with a method in the body/query. The member routes should be the documented canonical form; collection operations can remain compatibility adapters until callers are migrated.
- Storefront theme uses a resource read plus explicit draft/publish/rollback workflows. `publish` and `rollback` should remain named actions because they create audited domain transitions rather than generic CRUD updates.
- Every compatibility adapter must preserve the same permission, actor/shop context, validation, safe error envelope, and response shape as its canonical endpoint.
- Reviews SSR/client parity is now aligned: the page renders an empty shell and the client loads the list through `/api/admin/reviews`; remaining work is endpoint-level coverage and browser verification.

# Orders UI Area and Workflow Ownership

## Decision

Keep one unified Orders concept in the Admin navigation and user experience, while preserving separate workflow ownership in code.

The UI should present these entrypoints together:

```text
Orders
├── All orders
├── Create order
└── Historical records
```

This does not require one monolithic `OrdersWorkspace` component. The list, manual-order, historical-order, and Manager workflows have different state, permissions, data loading, and mutations.

## Recommended code shape

```text
src/app/admin/
  orders/
    list/       # browse, filter, select, inspect, and operate orders
    detail/     # detail view and inspector workflow
    actions/    # Admin Orders mutations
    types/      # Orders contracts
  manual-orders/
    workspace.tsx
    actions/    # live and historical order creation
  manager/
    orders/     # Manager-specific compatibility workflow
```

## Why the UI should be unified

- Users can find all order-related work from one navigation concept.
- Create order and historical record remain discoverable next to the order queue.
- Shared terminology and navigation reduce training cost.
- URLs can still identify the exact workflow and preserve back/forward/share behavior.

## Why the code should remain composed

The workflows are not the same:

| Workflow | Owns | Typical transitions |
| --- | --- | --- |
| Orders list | filters, pagination, selection, inspector state | status, payment, notes, archive, delete |
| Create order | customer/product/form state | create live order |
| Historical record | historical metadata and import-like form state | create historical record |
| Manager Orders | Manager layout and compatibility behavior | Manager-specific operational actions |

Combining these into one component with `mode`, `isHistorical`, `isManager`, and similar boolean props would recreate the original workspace complexity.

## Composition guidance

Use an Orders area or shell for navigation and shared layout, then compose explicit workflow components:

```tsx
<OrdersArea>
  {view === "list" && <OrdersListWorkspace />}
  {view === "create" && <ManualOrderWorkspace mode="live" />}
  {view === "historical" && <ManualOrderWorkspace mode="historical" />}
</OrdersArea>
```

The shell may share navigation, breadcrumbs, page chrome, and URL conventions. It must not own all query, mutation, dialog, and form state.

## Boundaries to preserve

- Manager Orders must remain separate from Admin Orders.
- Manual Orders must remain separate from the Orders list and detail workflows.
- Shared primitives belong in `admin/ui` or `admin/shared` only when they have multiple real consumers.
- Orders-specific contracts belong under `orders/types` or the relevant workflow folder.
- Route entrypoints must remain compatible with Next.js App Router conventions.

## What not to do

- Do not create one generic `AdminWorkspace` abstraction for every module.
- Do not put Manager components into `orders/` merely because they render orders.
- Do not move shared caches or UI primitives into Orders-specific folders.
- Do not change route URLs as part of a file-organization refactor.
- Do not combine structural moves with business-rule or API behavior changes.

## Implementation sequence

1. Keep the unified Orders navigation and document the three user-facing entrypoints.
2. Move list, detail, action, and type files according to ownership.
3. Keep temporary compatibility re-exports only where external consumers still exist.
4. Migrate consumers and remove compatibility shims after repository-wide import checks.
5. Add workflow-level contract tests.
6. Run typecheck, lint, full tests, and production build before pushing.

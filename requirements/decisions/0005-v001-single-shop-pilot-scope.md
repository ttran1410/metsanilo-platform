# ADR-0005 — v0.0.1 Single-Shop Pilot Scope and Permissions

**Status:** Accepted for v0.0.1  
**Date:** 2026-08-13  
**Supersedes for v0.0.1:** the role, tenant, channel, Google-delivery, and broad finance interpretations in ADR-0001 through ADR-0004.

## Context

The first release must be usable in two days. The earlier baseline described a multi-tenant platform, Facebook/WhatsApp integrations, Google route pricing, advanced finance, supplier workflows, and a broad CMS. Those capabilities are valuable later, but implementing them now would make the release longer and less reliable.

## Decision

### One shop

v0.0.1 operates one METSANILO shop. There is no shop organisation UI, tenant switcher, platform console, shop provisioning, subscriptions, or cross-shop workflow. The shop owner is the `ADMIN` role.

### Canonical roles

| Role | v0.0.1 authority |
|---|---|
| `ADMIN` | Shop owner; all shop permissions and user/permission management. |
| `MANAGER` | Employee; operational authority and management of Staff, Content Creators, and picker records. |
| `STAFF` | Employee; orders, invoice/payment records, picking entries, and any other feature explicitly assigned. |
| `CONTENT_CREATOR` | Public-site content and product content/media only, subject to assigned permissions. |
| External picker | Record-only person; no login, application workflow, or supplier account is required. |

`CONTENT_CREATOR` replaces the earlier `CONTENT_EDITOR` label. `PLATFORM_ADMIN` is deferred.

### Permissions

Permissions are feature-level codes assigned per user. `ADMIN` receives all codes. `MANAGER` receives the operational catalogue by default and may assign or revoke feature permissions for `STAFF` and `CONTENT_CREATOR`; a Manager cannot grant `ADMIN`. Staff does not receive finance approval, delivery-fee override, or user-management access unless explicitly assigned. Server-side authorization remains authoritative.

Admin and Manager may create, approve, and mark paid records they created. Staff may do the same only when the relevant approval/payment permission is explicitly assigned. All actions remain audited; this is intentional for the pilot and is not a separation-of-duties claim.

### Delivery

Delivery is always presented as **“Delivery to be agreed”**. Google Maps, Google Address Validation, Google Routes, postal-zone distance classification, route settings, provider toggles, and provider secrets are not part of v0.0.1. The customer provides delivery details; Admin, Manager, or Staff with `delivery.override` may enter an agreed fee and reason on the order. Until entered, the fee is pending and the item subtotal remains authoritative.

### Content and media

The pilot includes a full-page editor for the fixed public pages and sections (shop description, pickup instructions, product names/descriptions, and similar content), with Finnish and English values, draft/publish, preview, and revision history. Each product/page supports at most four images. Raw HTML, video uploads/embeds, arbitrary block schemas, and campaign composition are deferred.

### Orders, invoices, payments, and picking

The pilot keeps the existing order state machine and capacity invariants, basic payment recording for cash/bank transfer/MobilePay, localized invoice PDF generation/download, and a minimal picking record (`picker record + product + date + quantity + unit`). A picking record supports either `LITRE` or `KILOGRAM`; its buy price is stored per selected unit (`€/L` or `€/kg`) and the total is calculated from quantity × unit price. Customer orders and capacity remain litres-only. Staff can create these records when assigned the corresponding feature; Admin/Manager can approve/pay by default. Full expenses, supplier purchases, quality rates, payroll/earnings calculations, accounting exports, and advanced reports are deferred.

### Integrations and automation

Facebook, WhatsApp, shared inbox, broadcasts, provider webhooks, customer messaging automation, route automation, and scheduled marketing are deferred. Manual order source values such as phone or other may still be recorded without a connector. Core order reminders and state changes may be manual in the pilot; background automation is not a release dependency.

## v0.0.1 release gate

The release is acceptable only when a customer can browse Finnish/English content, submit one pickup or delivery-to-be-agreed order, and an authorized shop user can manage the product/capacity, order status, manual delivery fee, invoice/payment record, picking litres, and the relevant user permissions without overselling capacity. No Google, Meta, or WhatsApp API call may be required for this path.

## Deferred roadmap

Multi-shop organisation, Platform Admin, Google route pricing, postal zones, Facebook/WhatsApp, shared inbox, marketing, supplier/expense/quality modules, full finance/reporting, customer accounts, automated emails/SMS, video media, and advanced workflow automation remain future roadmap items. Their historical requirement IDs remain in the documents for traceability, but they are not v0.0.1 acceptance scope.

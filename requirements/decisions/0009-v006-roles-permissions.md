# ADR-0009 — v0.0.6 Shop Roles and Permissions

Status: Accepted for v0.0.6

## Scope

This release introduces the single-shop identity and feature-permission model while retaining the existing Basic-auth deployment gate. The Basic username selects a database user; the configured Basic secret is shared by this pilot and is not a replacement for production per-user authentication.

## Decisions

- Canonical roles are `ADMIN`, `MANAGER`, `STAFF`, and `CONTENT_CREATOR`.
- Admin and Manager receive the operational permission catalogue by role default. Admin is the shop owner and cannot be created by a Manager.
- Staff and Content Creator receive no operational permissions by default; Manager can grant or revoke explicit feature permissions for them.
- Permission checks are server-side and apply to API mutations and protected Manager data. Client-side navigation is only a convenience.
- Users are shop-scoped, active/inactive, and keyed by username. User creation and permission changes are audited.
- Existing Manager credentials remain compatible through a legacy Admin fallback until the seeded Admin user is present.
- This release does not add passwords, OIDC, MFA, multi-shop tenancy, invitations, or account recovery; those remain hardening work.

## Acceptance

- Admin/Manager can create Staff and Content Creator users and assign/revoke feature permissions.
- Manager cannot create Admin users or assign permissions to Admin/Manager targets.
- Staff/Content Creator API access is denied until the required permission is granted.
- Existing Manager product, availability, order, payment, and pickup flows remain usable for the Admin/Manager identity.

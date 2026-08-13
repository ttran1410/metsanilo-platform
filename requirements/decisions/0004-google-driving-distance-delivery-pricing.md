# ADR-0004 — Google Driving-distance Delivery Pricing

> **Historical / deferred for v0.0.1.** This design is retained for a future release. The pilot always shows “Delivery to be agreed,” never calls Google services, and uses a manually entered delivery fee.

Status: Accepted for implementation; production use remains subject to billing, EEA terms, privacy/processor, and credential approval  
Date: 2026-08-13  
Decision owners: Product and Business  
Supersedes: Postal-zone-only interpretation of ADR-0001 decision 7 and the interim delivery-origin recommendation

## Context

A postal code or zone cannot establish whether a customer is within 5 km of the shop. The business confirms that “5 km” means the shortest driving-route distance, not straight-line radius. The platform therefore needs a verified address and routing provider while retaining a safe order path when the provider cannot resolve an address/route.

## Decision

### 1. Provider and distance definition

- Google Maps Platform is the selected MVP mapping provider.
- When effectively enabled, Google Address Validation API validates/standardizes the configured delivery origin and customer destination; Finland is supported according to Google's current coverage documentation.
- Google Routes API `ComputeRoutes` is called server-side with `DRIVE` and the provider's shorter-distance reference-route option. The authoritative classification value is the returned route `distanceMeters`, not duration, straight-line distance, postal-zone membership, or a browser-calculated value.
- “Within 5 km” means a valid provider-returned shorter driving route with `distanceMeters <= 5000`. The system must not claim that Google enumerates every mathematically possible road path; it uses the shortest eligible route returned by the provider.

### 1.1 Cost-control enablement

- Google delivery integration is controlled by a platform kill switch and a per-shop `google_delivery_enabled` setting. It is effectively enabled only when both switches are on, production gates/credentials are ready, the origin has been validated, and the provider circuit is available.
- New shops default the per-shop setting to disabled. Platform Admin controls the platform kill switch; Platform Admin in selected-shop context and Manager control the shop setting. Staff cannot change provider/billing enablement but continues to manage operational delivery data and manual agreements.
- Disabling either switch immediately invalidates unconsumed Google delivery quotes and prevents new Address Validation and Routes calls for delivery quoting. Typed addresses receive local format validation only; the public result is `DELIVERY_TO_BE_AGREED` with no guessed distance/fee.
- The public UI does not expose whether fallback was caused by a disabled setting or provider failure. Internal audit/operations records `PROVIDER_DISABLED`, distinct from errors and beyond-distance outcomes.

### 2. Fee behavior

- Platform Admin in selected-shop context, Manager, and Staff configure a delivery-origin address, maximum local distance (initially 5,000 m), free-delivery litre threshold, and local fee. Google validation is required before automatic quotes can be enabled.
- The customer enters and confirms a validated destination address.
- Within the maximum distance, the configured volume threshold determines free versus local-fee delivery.
- When integration is disabled, outside the maximum, or when validation/routing is ambiguous, unavailable, or returns no drivable route, the order uses `DELIVERY_TO_BE_AGREED`; item subtotal remains authoritative while delivery fee/final total remain pending.
- Address, fulfillment date, origin, route result, or rule-version changes invalidate/recompute the quote.

### 3. Integration boundary and evidence

- Browser clients never decide eligibility or submit a trusted distance. Provider calls and fee calculation occur through the application backend.
- A short-lived server-signed quote binds normalized destination, origin/rule version, distance metres, provider, calculation time, and fee result. Submit revalidates the quote/rule and recomputes when stale.
- The order snapshots normalized customer address, origin/rule version, distance metres, provider/outcome, fee, and manual-agreement state. It does not persist unnecessary raw provider responses or route geometry.
- Provider failure never produces a guessed numeric fee or prevents a legitimate reservation request; it degrades to manual agreement and remains observable.

### 4. Security, privacy, terms, and cost

- Routes and address-validation credentials remain server-side and are restricted by application/API/IP or stronger supported controls. Billing quotas, budgets, latency, errors, and fallback rates are monitored.
- Finnish/English privacy notices identify the mapping/routing recipient/processor and purpose. Production requires review of current Google Maps Platform EEA terms, attribution/display rules, retention/caching restrictions, data-processing/transfer terms, and data minimization.
- Provider-derived data is retained only to the extent allowed and needed to evidence the order quote. The customer's business-required address remains governed by the platform's order-retention policy.

## Official provider references

- [Routes API — Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Shorter-distance routes](https://developers.google.com/maps/documentation/routes/shorter-distance-routes)
- [Address Validation coverage](https://developers.google.com/maps/documentation/address-validation/coverage)
- [Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)
- [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)

## Consequences

- Delivery rules, forms, transaction orchestration, data snapshots, permissions, QA, privacy, observability, stack guidance, phase planning, and external decision gates must be synchronized.
- Destination postal zones remain useful for reporting/manual fallback but are no longer the authoritative 5 km classifier.

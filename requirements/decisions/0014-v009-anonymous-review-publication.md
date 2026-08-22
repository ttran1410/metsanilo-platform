# ADR 0014: Anonymous Review Publication

## Status

Accepted

## Decision

Review publication identity is independent from buyer verification. A review may be anonymous or named and may independently be verified through a digital order, historical match, staff confirmation, or remain unverified.

Anonymous publication hides the reviewer identity from storefront responses. Staff retain the submitted identity and private contact/order data for moderation, verification, audit, and customer support. Public review responses must use a dedicated projection and must not expose private identity, contact, order, customer, original-text, moderation, or consent fields.

Existing reviews migrate as named reviews. New public submissions record the selected publication identity, reviewer name privately, and the consent source and timestamp. CRM customer creation or update requires separate explicit CRM consent and is never implied by publication consent or verification contact data.

Admin users with `reviews.moderate` or `reviews.write` may change publication identity. Anonymous-to-named changes require a reviewer name, consent source, and free-text consent note, create a dedicated audit entry, and return the review to moderation. Named-to-anonymous changes are immediate but remain auditable.

## Consequences

- Storefront labels are localized independently from private reviewer data.
- Verification badges continue to describe purchase evidence, not identity disclosure.
- Identity changes can temporarily remove an approved review from public publication while it is re-moderated.
- Legacy `displayName` remains as a private compatibility field while `reviewerName` becomes the private identity source.

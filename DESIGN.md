---
version: "alpha"
name: "Metsänilo — Forest Harvest"
description: "A warm Nordic editorial identity for a small, trusted wild-berry seller in Satakunta."
colors:
  primary: "#17372B"
  primary-soft: "#DCE8DF"
  on-primary: "#FFFDF7"
  accent: "#5D2B46"
  accent-soft: "#F0E2E8"
  on-accent: "#FFF9FB"
  canvas: "#F4F0E7"
  surface: "#FFFCF6"
  surface-muted: "#E9E4D9"
  ink: "#1D2822"
  ink-muted: "#657068"
  line: "#D8D3C8"
  focus: "#C26B35"
  success: "#2F6B4F"
  error: "#9B2E42"
typography:
  display:
    fontFamily: "Iowan Old Style, Baskerville, Georgia, serif"
    fontSize: "4.75rem"
    fontWeight: 500
    lineHeight: 0.96
    letterSpacing: "-0.045em"
  heading:
    fontFamily: "Iowan Old Style, Baskerville, Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "96px"
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-secondary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-muted:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  secondary-copy:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
  divider:
    backgroundColor: "{colors.line}"
    height: "1px"
  focus-ring:
    backgroundColor: "{colors.focus}"
    width: "3px"
  success-message:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  error-message:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "52px"
---

## Overview

Metsänilo should feel like a quiet Finnish forest morning: grounded, fresh, local, and assured. The visual language combines Nordic restraint with the warmth of a small seasonal producer. It is premium but never precious; artisanal but never rustic-themed.

The storefront is editorial rather than app-like. Large serif headlines carry emotion while calm sans-serif text handles prices, availability, and form controls. Generous negative space should make a short seasonal catalog feel intentional rather than empty.

## Colors

Spruce green is the main brand field and the default interaction color. Bilberry purple is used sparingly for availability, prices, and moments of conversion. Warm oat-colored neutrals replace pure white and cool gray.

- Never place body copy in low-contrast green or purple.
- Use accent purple for emphasis, not for large page backgrounds.
- Surfaces should feel layered through color and borders before shadows.

## Typography

Display and section headings use a soft editorial serif stack. Product information, navigation, form labels, and controls use a clear humanist sans-serif stack. Headlines use sentence case; uppercase is reserved for short eyebrows and operational labels.

## Layout

Content sits within a 1200px maximum width. The hero uses an asymmetric two-column composition with the product image crossing the edge of the green field. Sections have strong vertical rhythm, and narrow screens collapse to a single column without reducing touch target sizes.

## Elevation & Depth

Prefer one-pixel warm-gray borders, overlapping blocks, and tonal surfaces. Shadows are subtle and reserved for floating controls or the active reservation panel. Avoid generic stacked cards with identical shadows.

## Shapes

Large editorial containers use 28px corners. Inputs use 8px corners for clarity. Primary actions and small status labels are pill-shaped. Decorative forms may echo berries and leaves using simple circles and organic crops.

## Components

Product cards use edge-to-edge photography, clear package rows, and a single primary action. Reservation steps are separated by generous whitespace and numbered circular markers. Availability is shown with compact badges and readable dates. Every action must preserve a 44px minimum touch target.

## Do's and Don'ts

- Do use real product imagery and specific local copy.
- Do keep prices, package sizes, remaining stock, and pickup terms immediately scannable.
- Do let the seasonal nature of the shop feel calm and finite.
- Don't use gradients as decoration, generic dashboard cards, emoji icons, or excessive badges.
- Don't make the storefront look like the Manager interface.
- Don't hide order terms or introduce urgency that the inventory data does not support.

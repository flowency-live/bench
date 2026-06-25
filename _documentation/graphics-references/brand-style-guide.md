# Change Connected Brand Style Guide

> **Canonical tokens live in [`brand-tokens.md`](brand-tokens.md)**, verified against the live site
> `changeconnected.co.uk` (see [ADR-0004](../adr/0004-brand-source-of-truth.md)). This guide is the
> descriptive companion; where they differ, `brand-tokens.md` wins.
>
> Corrected 2026-06-25: earlier values (navy `#0a1929`, lime `#c5f82a`, Oswald/Inter) were **wrong**
> and have been replaced with the live-site truth below.

## Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Deep Navy | `#001930` | Primary background (matches site `theme-color`) |
| Lime Green | `#BAEB5B` | Accent headings, CTAs |
| White | `#FFFFFF` | Body text, icons |

### Secondary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Blue-grey | `#9DADC8` | Secondary / muted text |
| Raised Navy | `#002E52` | Cards, containers, lifted surfaces |

### Gradient

- The site uses **no multi-stop UI gradient**. The green→teal→blue gradient is a **logo-mark
  treatment only** and lives inside the logo asset, not as a UI token.
- Profile headshot-ring gradient is a renderer design choice, kept subtle/optional.

---

## Typography

### Headings

- **Font**: **Poppins**, weight **900** (extra-bold)
- **Color**: Lime Green (`#BAEB5B`) for accent headings; White for neutral headings
- **Examples**: "Our Purpose", "Our Partnership Approach", "Connect With Us"

### Body Text

- **Font**: **Poppins**, weight 400
- **Color**: White (`#FFFFFF`)
- **Line Height**: ~1.5

### Navigation

- **Font**: Poppins
- **Color**: White

---

## Logo

- **Symbol**: Abstract interlocking mark / infinity loop
- **Colors**: Green-to-blue gradient (in-asset)
- **Text**: "CHANGE CONNECTED" in white, stacked two lines
- **Clear Space**: Maintain padding equal to the height of the "C" in CHANGE

---

## UI Components

### Buttons

- **Primary Style**: Outlined/bordered (not solid fill)
- **Border**: White or lime green, 1–2px
- **Hover**: Subtle fill or glow

### Section Dividers

- **Style**: Short horizontal line under section headings
- **Width**: ~60–80px

### Cards/Containers

- **Background**: Raised navy (`#002E52`) or semi-transparent overlay
- **Border Radius**: Subtle rounding (4–8px)

---

## Imagery Style

- **Theme**: Connection, collaboration, the right people fitting together
- **Treatment**: Dark navy overlay (~45–70% opacity) for text legibility
- **Subjects**: People working together, network/connection visuals

---

## Spacing & Layout

- **Max Content Width**: ~1200px centered
- **Section Padding**: Generous vertical padding (80–120px)
- **Text Width**: Body text max ~700px for readability

---

## Brand Voice

- **Tone**: Professional, confident, partnership-focused
- **Keywords**: Connect, talent, change, deliver, transform
- **Tagline**: "Connecting great talent, delivering great change"

---

## Footer

- **Background**: Deep navy (`#001930`)
- **Elements**: Company name, email, LinkedIn icon, copyright
- **Company Number**: 16401015

---

## Quick Reference

```css
:root {
  --color-bg-primary: #001930;
  --color-bg-panel: #002e52;
  --color-accent: #baeb5b;
  --color-text-primary: #ffffff;
  --color-text-secondary: #9dadc8;

  --font-heading: 'Poppins', system-ui, Arial, sans-serif; /* weight 900 */
  --font-body: 'Poppins', system-ui, Arial, sans-serif;    /* weight 400 */

  --spacing-section: 100px;
  --max-content-width: 1200px;
  --border-radius: 6px;
}
```

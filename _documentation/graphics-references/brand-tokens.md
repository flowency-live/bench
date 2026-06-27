# Bench — Canonical Brand Tokens

**Tenant:** Change Connected (pilot tenant #1, instance "Change Hub")
**Source of truth:** the live site `https://changeconnected.co.uk` — see [ADR-0004](../adr/0004-brand-source-of-truth.md).
**Verified:** 2026-06-25, by inspecting the live site's computed styles.

> These are **tenant #1's** tokens. In Bench they belong on the Tenant `brandTokens` record; the
> renderer themes per tenant. The product's `DEFAULT_BRAND_TOKENS` should be a **neutral** default,
> not these values.

## Colour

| Token | Hex | Usage |
|-------|-----|-------|
| Navy (primary background) | `#001930` | Page background, headers, footer. Matches the site `theme-color`. |
| Lime (accent) | `#BAEB5B` | Headings, CTAs, accents. (`rgb(186,235,91)`) |
| White (primary text) | `#FFFFFF` | Body text on navy. (Site renders a near-white `#FFFCFC`.) |
| Blue-grey (secondary text) | `#9DADC8` | Muted/secondary text, captions. |
| Raised navy (panel/surface) | `#002E52` | Cards/containers, slightly lifted from the background. |

## Typography

- **Family:** **Poppins** for everything (the live site uses Poppins 300/400/600/700/900).
  - **Display / headings:** Poppins **900** (e.g. H1 ~64px, lime H2s).
  - **Body:** Poppins **400**, line-height ~1.5 (site uses 27px on 18px).
- Fallback stack: `'Poppins', system-ui, Arial, sans-serif`.
- **Not** Oswald (old style guide) and **not** Fredoka (old PRD §11). Poppins only.
- **Web wiring:** Poppins is self-hosted via `next/font` (`--font-poppins`); the app's `--font-display`
  / `--font-body` reference it. Do not rely on the Google-Fonts `@import` alone — it's unreliable in the
  build and left headings on a fallback (fixed 2026-06-25).

## Gradient

- The live site uses **no multi-stop UI gradient**. The only background "gradient" is a navy image
  overlay (`rgba(0,25,48,0.45)`).
- The green→teal→blue gradient referenced in older docs is a **logo-mark treatment** that lives inside
  the logo asset (`logo-qt=q_95.webp`), not a UI token. The exact endpoints are not reliably
  derivable from CSS; treat the logo as the artefact of record.
- **Rule (2026-06-25):** the gradient is reserved for the **logo only**. UI avatars/monograms use flat
  lime-on-navy (lime ring + lime initials), not the gradient — splashing it across every avatar cheapens
  the mark. The profile headshot is a clean lime ring (grayscale photo when present).

## CSS custom properties (canonical)

```css
:root {
  /* Colour */
  --color-bg-primary: #001930;   /* navy */
  --color-bg-panel:   #002e52;   /* raised navy surface */
  --color-accent:     #baeb5b;   /* lime */
  --color-text-primary:   #ffffff;
  --color-text-secondary: #9dadc8;

  /* Typography */
  --font-display: 'Poppins', system-ui, Arial, sans-serif; /* weight 900 */
  --font-body:    'Poppins', system-ui, Arial, sans-serif; /* weight 400 */

  /* Layout */
  --max-content-width: 1200px;
  --spacing-section: 100px;
  --border-radius-md: 6px;
}
```

## Accessibility

- Lime `#BAEB5B` on navy `#001930` and white `#FFFFFF` on navy both meet WCAG 2.1 AA.
- Lime is a **background/accent**, not body-text colour on light backgrounds — lime text on white
  fails contrast; never use it for body copy on a light surface.
- Per PRD §11, AA contrast is a **render-time guarantee** validated once on the token pairs, not a
  per-profile check.

## Other references

- **Company number:** 16401015
- **Tagline:** "Connecting great talent, delivering great change"
- **Logo:** abstract interlocking infinity/X mark + white "CHANGE CONNECTED" wordmark; green→teal→blue
  gradient in-asset; transparent-keyed. The white wordmark means **use on dark/navy backgrounds only**
  (a dark-on-light variant is still needed for light surfaces). Source:
  `graphics-references/logo-qt=q_95.webp`. In the web app it's served at `/logo-change-connected.webp`
  (`apps/web/public/`) and used in the header, profile footer, share page, and the PDF print header.

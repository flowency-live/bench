# ADR-0004: Brand source of truth — the live site

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** §11 Branding & website continuity; §7 P0 "Brand & website continuity"

## Context

Brand values conflicted across three sources:

| Token | PRD §11 | Style guide | Phase 0 code | **Live site (verified)** |
|-------|---------|-------------|--------------|--------------------------|
| Navy  | `#001930` | `#0a1929` | `#0a1929` | **`#001930`** |
| Lime  | `#BAEB5B` | `#c5f82a` | `#c5f82a` | **`#BAEB5B`** |
| Display font | Fredoka | Oswald | Oswald | **Poppins (900)** |
| Body font | Poppins | Inter | Inter | **Poppins (400)** |

Brand continuity is a **P0**: every surface must read as an extension of `changeconnected.co.uk`.
The only authoritative source for "does this match the site" is therefore **the site itself**.

## Decision

**`changeconnected.co.uk` is the canonical source** for tenant #1's brand tokens. Values were verified
on 2026-06-25 by inspecting the live site's computed styles. The canonical token set lives in
[`graphics-references/brand-tokens.md`](../graphics-references/brand-tokens.md) and becomes tenant
#1's `BrandTokens` row. The renderer themes **from the Tenant record**, not from hardcoded values.

Canonical tokens: navy `#001930`, lime `#BAEB5B`, white `#FFFFFF`, secondary blue-grey `#9DADC8`,
raised navy panel `#002E52`, font **Poppins** (display 900 / body 400). There is **no multi-stop
UI gradient** on the live site; the green→blue gradient is a **logo-mark treatment only** and lives
inside the logo asset.

## Consequences

- **Positive:** the P0 continuity requirement is anchored to ground truth, not to drifting docs.
- **Negative / costs:** the Phase 0 code tokens are wrong and must be corrected.
- **Follow-up work:**
  - Fix `packages/@bench/ui/src/theme/tokens.css` (currently `#0a1929` / `#c5f82a` / Oswald / Inter).
  - Fix `DEFAULT_BRAND_TOKENS` in `packages/@bench/types/src/domain/tenant.types.ts`. Note:
    `DEFAULT_BRAND_TOKENS` should be a **neutral platform default**, not Change Connected's — Change
    Connected's values belong on tenant #1's row, not in the product default.
  - Reconcile PRD §11 (drop "Fredoka" → Poppins) and the style guide (done).
  - Load Poppins (300/400/600/700/900) self-hosted or via the existing font pipeline; ensure the PDF
    renderer (headless Chromium) has the fonts available.

## Alternatives considered

- **Style guide values (Phase 0 code)** — rejected: don't match the live site; fail the P0.
- **PRD §11 values** — closest (navy + lime correct) but the display font (Fredoka) is wrong.

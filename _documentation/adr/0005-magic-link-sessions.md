# ADR-0005: Link-scoped sessions — hashed tokens + KMS-signed JWT

- **Status:** Accepted (ratifies the design in PRD §8; reuses the belterpoc pattern)
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** §8 Magic-link mechanics; §4 Roles & permissions; §12 (Lambda authorizer)

## Context

Consultants and clients are **not account holders** in V1 — a magic link grants a short-lived session
scoped to one profile and one action. This is the spine of the product, so it is specified, not
assumed. The pattern is proven in `belterpoc` (magic-link email + signed session cookies) and is
reused rather than rebuilt.

## Decision

- **Token:** 32 bytes from a CSPRNG, URL-safe base64. The raw token lives **only in the URL**.
- **At rest:** store **only a SHA-256 hash** of the token, alongside type, target profile id, scope,
  expiry, status, created-by/at (and passcode hash for the P1 per-share passcode).
- **On open:** validate hash + expiry + status, then mint a **short-lived (~2h) KMS-signed JWT**
  session cookie scoped to `profile + action` — not a full account session. Re-derivable from the
  still-valid link. An **API Gateway Lambda authorizer** enforces scope on every API call.
- **Hardening:** rate-limit validation/minting; WAF on public routes; revoke flips status and
  validation **fails closed**; link routes are `no-index`, `no-cache`, and never expose the profile id.
- **Constant-time comparison:** passcode/token-hash checks use `crypto.timingSafeEqual`, not `!==`.

## Consequences

- **Positive:** no password/account surface for V1; leaked DB reveals only hashes; tight blast radius
  per link; consistent with owner auth (Cognito) living separately.
- **Negative / costs:** KMS signing key managed in KMS/Secrets Manager with rotation; session TTL
  tuning; careful revoke semantics.
- **Follow-up work:**
  - The existing `@bench/domain` magic-link code aligns. **Fix `validateMagicLink` to use
    `timingSafeEqual`** for the passcode-hash comparison (currently `!==`, a minor timing-side-channel).
  - Implement the KMS-signed JWT mint + Lambda authorizer when the API stack lands.

## Alternatives considered

- **Cognito sessions for consultants/clients** — rejected for V1: account friction defeats the
  "no sign-up" goal. (V2 promotes Change Makers to Cognito accounts — see PRD §17.1.)
- **Opaque server-side sessions only** — viable, but KMS-signed JWTs avoid a session-store round trip
  in the authorizer and match the proven belterpoc pattern.

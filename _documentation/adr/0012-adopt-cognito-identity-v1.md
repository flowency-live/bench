# ADR-0012: Adopt Cognito as the V1 identity provider (owners + godmode)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Jason Jones (founder), CTO (Claude)
- **Supersedes:** [ADR-0009](0009-admin-auth-magic-link.md) (passwordless-only owner auth)
- **Relates to:** [ADR-0005](0005-magic-link-sessions.md) (link-scoped sessions — retained for consultants/clients), [ADR-0010](0010-multi-tenant-control-plane.md) (godmode = Google `@flowency.co.uk`)
- **PRD link:** §7 "Owner authentication" (re-aligns with its original Cognito intent), §17.1 (V2 social auth, partly pulled forward)

## Context

Two needs converged:

1. **Godmode** (ADR-0010) requires Google sign-in for `@flowency.co.uk` platform admins.
2. Jason wants **tenant owners** to sign in with **email/password** (familiar), not magic-link only.

ADR-0009 had deferred Cognito and made owner auth passwordless-only "for the simplest path to ship." That no longer matches what we want: godmode needs federation, and owners want passwords. Rather than hand-roll Google OIDC and a bespoke password store, we have **proven prior art**: `bndy-backstage` already runs a Cognito-backed, multi-provider auth (Google federation + email/password + phone OTP + email magic-link) with a **server-issued session cookie**. Its client contract is visible in the mounted repo (`/auth/google`, `/api/me`, an httpOnly cookie session, and a `cognitoId` on the user); the server handler lives in `bndy-serverless-api/auth-lambda/handler.js`.

The original PRD §7 actually specified Cognito; ADR-0009 was the temporary deviation. This ADR returns to that intent and standardises one identity layer across both authenticated surfaces.

## Decision

In the context of **owner and godmode authentication**, facing **the need for Google sign-in (godmode) and familiar email/password (owners), plus the cost of maintaining several bespoke auth paths**, we decided to **adopt Amazon Cognito as the V1 identity provider for owners and platform admins — Google federation for godmode and email/password (with verification + reset) for owners — porting the proven `bndy-backstage` pattern (Cognito identities behind our own `bench_session` cookie)**, and neglected **staying passwordless-only (ADR-0009) and hand-rolling Google OIDC without Cognito**, to achieve **one identity layer reused across both surfaces, aligned with PRD §7 and de-risking V2 §17.1**, accepting **that Cognito (a managed external dependency requiring OAuth + SES setup) enters V1 earlier than originally scoped, and that ADR-0009 is superseded.**

### Scope boundary (critical)

Cognito covers **owners + platform/godmode only**.

- **Consultants and clients keep link-scoped magic-link sessions (ADR-0005) — unchanged.** Zero-friction, no accounts, no Cognito. This is the product's core "no sign-up" promise and is not touched.
- **Magic-link remains a fallback for owner sign-in** (the ADR-0009 path stays wired), so admin login keeps working through cutover.
- The session everywhere remains our HMAC-signed `bench_session` cookie; Cognito tokens are exchanged for it at the callback. We do not adopt Cognito-managed sessions.

## Consequences

**Good**
- One identity layer: godmode Google federation and owner email/password come from a single Cognito user pool.
- Reuses `bndy-backstage` prior art instead of inventing auth twice.
- Re-aligns with PRD §7 and lays the groundwork for V2 §17.1 (consultant social auth) without another rebuild.

**Costs / risks**
- Cognito user pool + federation/hosted config; **Google OAuth app registration (Jason prereq)**; **SES** for verification/reset emails (couples to Phase 4); password-reset flows.
- A mapping layer: Cognito identity → our `bench_session`, and a `cognitoId`/identity binding on the User record (DATA lane).
- External dependency and setup land earlier than V1 originally scoped.
- **MFA for godmode** is not in this ADR — tracked as hardening (CP4).

**Migration**
- No data migration: DynamoDB single-table unchanged (ADR-0008). User records gain an identity binding.
- ADR-0009's magic-link owner path is retained as fallback, so there is no hard cutover.

## Reference & prerequisites

- **Port target:** `bndy-serverless-api/auth-lambda/handler.js` (the Cognito + Google + session-cookie handler). Not in the mounted folders — Jason grants the `web`/`infra` agents access for the port.
- **Contract (already visible):** `bndy-backstage` `auth-service.ts` — `/auth/google`, `/api/me`, cookie session, `cognitoId`.
- **Jason prereqs:** register the Google OAuth app (client id/secret); approve SES domain verification for `bench.opstack.uk`.

## Compliance

- Godmode restricted to the `@flowency.co.uk` allowlist (ADR-0010); reject all other domains at the callback.
- Owner email domain is per-tenant; the User record's `tenantId` is authoritative for scoping (not the email domain).
- Consultant/client paths must remain Cognito-free (ADR-0005) — checked at review.

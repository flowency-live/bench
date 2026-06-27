# ADR-0009: Admin/owner authentication — passwordless magic-link (V1)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO
- **Amends:** [ADR-0005](0005-magic-link-sessions.md) (the owner-auth portion), PRD §7 "Owner authentication"
- **PRD link:** §7 P0 Owner authentication; §8 Magic-link mechanics; §17.1 (V2 social auth)

## Context

PRD §7 specified owner login via **Amazon Cognito** (Google federation + email). For V1 the founder
asked for the simplest path to a working admin login — *"send the admin a magic link, he creates his
admin account."* Standing up Cognito hosted UI + federation for the owner adds friction and external
setup (OAuth app registration) not needed to ship, and the magic-link + signed-session machinery
already exists (ADR-0005; `@bench/data` `MagicLinkRepository`; GSI3 token lookup).

## Decision

Admin (tenant owner) auth in V1 is **passwordless magic-link** with a signed session cookie:

- Authorised admin emails come from `ADMIN_EMAILS` (env) plus the seeded founder.
- `/login` → email → mint a single-use, 30-min magic link (`type:'invite'`, `scope:'edit'`, sentinel
  `profileId:'ADMIN'`, `createdBy:<email>`) → `/auth/verify` validates it and establishes the session.
- Session = **HMAC-SHA256-signed cookie** `bench_session` (Web Crypto, verifiable in Edge middleware),
  payload `{ kind:'admin', tenantId, email, role:'owner', exp }`, ~8h. Signing key `SESSION_SECRET`.
- **Route protection** via Next middleware: admins reach all protected routes; **members** get a
  scoped `{ kind:'member', profileId }` session that only reaches their own `/profiles/:id/edit` wizard.
- In production the link is **emailed via SES** (backlog S2); until SES lands, a bootstrap script mints
  the founder's first `/auth/verify` link (production suppresses the on-screen dev link by design).

Cognito + social federation (Google / Apple / **LinkedIn-OIDC**) is **deferred to V2** for *members*
(PRD §17.1), layered onto the same invite → claim flow (the claim binds the social identity to the
profile). The owner can also move to Cognito later if multi-admin/SSO is needed.

## Consequences

- **Positive:** ships now; no external OAuth setup to get an owner logged in; reuses the magic-link
  spine; one consistent session model for admin + member; middleware-based gating (doesn't touch pages).
- **Negative / accepted:** no durable multi-admin **User** entity yet (authorised-email + valid link =
  access); **`SESSION_SECRET` must be set in every deployed env** (the dev fallback is intentionally
  non-secret — unset = forgeable sessions); production admin login depends on SES (S2) or the bootstrap.
- Supersedes the "Cognito for owner" mechanism in ADR-0005 / PRD §7. The underlying *requirement*
  (secure owner login + short-lived scoped link sessions) is unchanged.

## Alternatives considered

- **Cognito hosted UI for the owner now** — rejected for V1: setup friction + external OAuth apps, not
  needed to ship. Revisit for multi-admin / SSO.
- **Email + password** — rejected: the founder asked for magic-link; passwords add reset flows and
  credential storage for no V1 benefit.

## Implementation

`apps/web/lib/auth/*` (session-token, session, admins), `app/login/*`, `app/auth/{verify,logout}`,
`middleware.ts`, `app/invite/[token]/*`. Env: `SESSION_SECRET`, `ADMIN_EMAILS`.

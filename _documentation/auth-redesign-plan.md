# Auth Redesign — Passwordless, invite-only, multi-method (the bndy model)

**Status:** Proposed (supersedes ADR-0012's *owner email/password* decision — pending Jason sign-off)
**Author:** CTO (Claude)
**Refs:** ADR-0009 (magic-link), ADR-0010 (control plane), ADR-0012 (Cognito), ADR-0013 (brand). Studied: `bndy-backstage` (`BNDY_PLATFORM_BIBLE.md`, `client/.../auth/login.tsx`, `auth-service.ts`).
**Date:** 27 June 2026

---

## 1. Why the current auth is flaky (root causes, code-confirmed)

Bench's owner auth is **password + Cognito self-signup centric**, and three bugs collide:

1. **Password policy vs message mismatch.** `auth/claim` validates `minLength 12`; the pool (`bench-auth-stack.ts`) requires **12 + upper + lower + digit + symbol**; the error copy says "at least 8…with uppercase, lowercase, numbers." A 12-char password without a symbol passes the client and fails Cognito → confusing "complexity" error.
2. **Non-idempotent sign-up → "account already exists".** `completeClaim()` calls `SignUpCommand`. Once the Cognito user exists, any retry throws `UsernameExistsException`. One stumble (or a failure in a later step — `getUserSub`/`bindIdentity`/session) leaves a half-created account you can't get past.
3. **Password sign-in is disabled at the pool.** `cognito.signIn()` uses `USER_PASSWORD_AUTH`, but INFRA hardened the client to **SRP-only** and `selfSignUpEnabled:false`. So the sign-up and sign-in flows contradict the pool config — different failures each attempt.

Net: the **password flow is the problem**. It is brittle, contradicts the pool, and gives a poor first-run.

## 2. How bndy does it (the proven model)

- **Passwordless, multi-method.** Phone OTP (SMS, 5-min), Email magic link (5-min), Google + Apple (Cognito federation, server-side token exchange). **No passwords anywhere.**
- **Identity-first sign-in = sign-up.** Verifying an OTP / magic link / social either signs you in or returns `requiresOnboarding` for a new identity. There is no separate "create account / set password" step, so `UserExists` and password-policy errors simply don't exist.
- **Invite is decoupled from auth.** Admins generate **shareable invite links / QR / SMS** (`bndy-invites`, 7-day TTL). The token is held (`pendingInvite`), the user authenticates by *any* method, then **accepts** the invite (`/api/invites/{token}/accept`) to join. Clean, idempotent.
- **Session** is a server-issued cookie; Cognito just proves identity. UI is a tidy **tabbed** card: Phone / Email / Socials.

## 3. Proposed Bench auth (target)

**Principle: passwordless-first, invite-only, every method converges on our existing `bench_session` HMAC cookie.** Delete the Cognito password/sign-up path entirely.

### Sign-in methods (one tabbed screen, like bndy)
1. **Email magic link** — *primary.* We already own this machinery (`MagicLinkRepository`, GSI3, SES). Make it **idempotent**: clicking a valid link mints the session; a new identity holding a pending invite is bound + activated. No password.
2. **Google** — Cognito federation (already deployed for godmode); extend to owners; callback exchanges the federated identity for a `bench_session`.
3. **Apple** — add Apple as a Cognito IdP, **reusing the bndy Apple Service ID / dev account**; same callback shape as Google.
4. **LinkedIn** — "Sign in with LinkedIn using OpenID Connect" as a Cognito **OIDC** provider; same callback shape.
5. **Phone OTP** — *included* (Jason's call, full bndy parity). AWS Pinpoint/SNS SMS + a 6-digit code table (5-min TTL), mirroring `bndy`'s `/auth/phone/*`.

### Invite-only (no open sign-up)
- **No identity gets in without either** (a) an existing tenant binding (returning user) **or** (b) a **valid invite token** held during sign-in. An unknown email/social with no invite → "Bench is invite-only."
- **Invite = a single-use, tenant+role-scoped magic link** (Bench's requirement; stricter than bndy's reusable 7-day link).
  - **godmode → tenant admin**: generate the invite link.
  - **tenant admin → consultant**: generate the invite link (binds to that tenant, member role, the consultant's profile).
- **Generate-and-share, not auto-email-only.** The generator returns the link and offers **Copy / WhatsApp / Email / SMS** (and a native share). Owners/godmode share it themselves — they will *not* want everything sent from `opstack.uk`. (This folds in the previously-spec'd AJ6 share menu + godmode link-gen.)
- **Decouple invite from auth** (bndy pattern): sign in by any method, then the held invite token is **claimed** (binds tenant + role + activates). This kills the brittle "magic link = auth + claim + set-password" chain.

### Session
- Keep the `bench_session` cookie (works, edge-safe). Magic-link path needs no Cognito at all. Social paths use Cognito federation only to *prove identity*, then we mint `bench_session` (exactly how bndy mints its JWT). `bindIdentity(cognitoId)` still records the link for socials.

## 4. What this changes

- **Supersedes ADR-0012's A2 (owner email/password).** Owners become **passwordless** (magic link + socials). Cognito stays — but only as the **federation broker** for socials, not for passwords. ADR-0005 (consultant/client magic-link) is unchanged and now the model for *everyone*.
- **Delete:** `auth/claim` set-password page, `cognito.signUp/signIn/changePassword`, the password fields on `/login`, `/forgot-password`, `/reset-password`. (Reset/forgot disappear — nothing to reset.)
- **INFRA:** add Apple + LinkedIn IdPs to the pool; remove the now-unused password/SRP client flows; (optional) Pinpoint SMS if phone OTP is in.
- New ADR (0014) once decisions below are locked.

## 5. Build plan (lanes — after sign-off, TDD, gated)

- **INFRA:** add Apple IdP (reuse bndy Service ID) + LinkedIn OIDC IdP to the Bench Cognito pool; expose callback URLs; drop password/SRP-only client flows; (if phone) Pinpoint.
- **DATA:** invite tokens already exist (`MagicLinkRepository`, single-use). Add a tiny `acceptInvite`/binding helper if needed (bind tenant+role+activate on first auth). No password tables.
- **WEB:** one tabbed `/login` + `/auth/callback` (Email / Google / Apple / LinkedIn), the **invite generator with Copy/WhatsApp/Email/SMS** in godmode (tenant admin) and on the dashboard (consultant invite), idempotent magic-link verify, held-invite claim post-auth. Remove claim/forgot/reset/password UI.
- **Acceptance:** generate an invite link in godmode → open it in a fresh browser → sign in with **any** method → land bound to that tenant as admin; repeat the link → "already used"; an uninvited Google account → rejected; no password anywhere.

## 6. Decisions — DECIDED 2026-06-27 (→ ADR-0014)

- **Passwords: dropped entirely.** Fully passwordless. Remove the claim/forgot/reset/password surface.
- **Phone OTP: included** (full bndy parity → Pinpoint/SNS SMS).
- **Methods:** Email magic link · **Phone OTP** · Google · Apple (reuse bndy Service ID) · LinkedIn (OIDC). All converge on `bench_session`; all invite-only.

# Auth Journey — Deploy & Test Runbook

**Status:** auth journey built + gate-green (179 tests, full build). This is the runbook to deploy it and prove it works in production. Plan: `auth-journey-build-plan.md` · Decisions: ADR-0012 · Status ledger: `BACKLOG.md`.
**Last updated:** 27 June 2026

---

## 1. Prerequisites (all done — confirm before deploy)

- **Cognito user pool** `eu-west-2_QjvjE2Cvl`, client `7c6m3ubjne0u3adejpn58ou8cr`, domain `bench-auth.auth.eu-west-2.amazoncognito.com` (Google IdP + email/password, SRP).
- **Google OAuth app** registered; authorized redirect `https://bench-auth.auth.eu-west-2.amazoncognito.com/oauth2/idpresponse`.
- **SES**: apex `opstack.uk` identity verified + DKIM; sender `noreply@opstack.uk`.
- **IAM** policy v2 (`bench-amplify-runtime-policy`) attached to `bench-amplify-service-role` (grants `ses:SendEmail` + the Cognito actions + `bench-main` access).
- **DynamoDB** `bench-main` with GSI1 (`EMAIL#`), GSI2 (status), GSI3 (token hash), TTL enabled.

## 2. Environment variables (set on the deployed app)

| Var | Value | Notes |
|-----|-------|-------|
| `SESSION_SECRET` | strong random string | **REQUIRED** — without it the session HMAC falls back to a known dev secret and admin sessions are forgeable |
| `DATA_BACKEND` | `dynamodb` | switches off the in-memory fixtures |
| `BENCH_TABLE_NAME` | `bench-main` | |
| `AWS_REGION` | `eu-west-2` | |
| `COGNITO_USER_POOL_ID` | `eu-west-2_QjvjE2Cvl` | |
| `COGNITO_CLIENT_ID` | `7c6m3ubjne0u3adejpn58ou8cr` | |
| `PLATFORM_ADMIN_EMAILS` | `jason@flowency.co.uk` | godmode Google allowlist (comma-sep) |
| `ADMIN_EMAILS` | `oliver@changeconnected.co.uk` | owner allowlist (comma-sep) |
| `ASSETS_BUCKET` / `ASSETS_CDN_DOMAIN` | — | only needed once photo upload (S5) is wired |
| `AUTH_BYPASS` | **unset / not `true`** | dev-only auto-admin; MUST be off in prod |

## 3. Deploy steps

1. Confirm §2 env vars are set in Amplify; **`AUTH_BYPASS` is unset**.
2. **Seed** `bench-main` if empty: `pnpm --filter @bench/data seed` (writes the Change Connected tenant + Oliver admin + 2 profiles, all two-axis status). Oliver has **no `cognitoId`** → his first sign-in is the magic-link → `/auth/claim` path to set a password.
3. Commit, push, let Amplify build (`amplify.yml`, pnpm/corepack) and deploy.
4. Confirm SES domain shows **verified** (DKIM propagated) before relying on email sends.

## 4. Smoke tests (run on the deployed site)

| # | Test | Expected |
|---|------|----------|
| T1 | `/login` → owner email (`oliver@…`) → magic-link mode | SES email arrives; link → `/auth/claim` (no password yet) → set password (≥12, symbol) → dashboard shows only CC profiles |
| T2 | `/login` → same owner → password mode | signs in → dashboard |
| T3 | `/forgot-password` → code → `/reset-password` | reset succeeds; new password works at `/login` |
| T4 | `/godmode/login` → "Sign in with Google" (`jason@flowency.co.uk`) | lands on `/godmode` tenant list (**proves AJ2a OAuth-state works in prod**); a non-`@flowency.co.uk` Google account is rejected |
| T5 | godmode → create tenant "Acme Corp" + `admin@acme.com` | onboarding email sent; godmode list shows Acme |
| T6 | claim Acme link → set password | lands on an **empty** Acme dashboard (scoped) |

## 5. Isolation proof (AJ5) — the acceptance gate

**UI:**
1. As the Acme admin (T6), create a consultant profile.
2. In godmode, switch into Change Connected.
3. **The Acme profile must NOT appear** in CC's Collective, and vice-versa.

**Data (DynamoDB) — partitions must be disjoint:**
```bash
# CC items (PK partition)
aws dynamodb query --table-name bench-main --region eu-west-2 \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"TENANT#change-connected"}}'

# Acme items
aws dynamodb query --table-name bench-main --region eu-west-2 \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"TENANT#acme-corp"}}'

# Login lookup resolves to the RIGHT tenant only
aws dynamodb query --table-name bench-main --region eu-west-2 --index-name GSI1 \
  --key-condition-expression "GSI1PK = :e" \
  --expression-attribute-values '{":e":{"S":"EMAIL#admin@acme.com"}}'
```
**Pass:** no item from one tenant's partition appears under the other; `getByEmail` for an Acme admin returns only `tenantId: acme-corp`.

**Cascade (AJ7):** delete Acme in godmode, then re-run the Acme `PK` query and the `EMAIL#admin@acme.com` GSI1 query — **both must return zero items** (no orphans, no cross-tenant `getByEmail` leak).

## 6. Known deferred (NOT in this journey — tracked in BACKLOG)

Safe to ship the pilot without these, but they're the next hardening wave:
- **CP2** persisted audit log · **CP3** impersonation banner · **CP4** rate-limit + MFA-for-godmode · **CP5** soft-delete/retention (delete is a hard purge today).
- **CP6** per-tenant branding edit (CC brand is still hardcoded) · **CP8** platform RBAC (allowlist is env, single admin) · **CP10** GDPR · **CP11** observability/metrics.
- **S3** server-side PDF · **S5** photo-upload asset pipeline (`map-domain` still passes the headshot id through).
- **W-P1/W-P2** claim polish (password-policy match; assert pending user before `signUp`) if not already merged.

## 7. Rollback

Amplify keeps the previous build — redeploy the prior commit if a smoke test fails. No data migration was involved (DynamoDB schema unchanged; the seed is additive), so rollback is app-only.

# Bench — Backlog & Status

The single source of truth for **work**: what's done, what's next, who owns it. Updated as work lands.

**Division of docs (so nothing doubles up):**
- **PRD** (`prd-consultant-profile-platform.md`) — *what* we're building (requirements).
- **ADRs** (`adr/`) — *why* we made a binding technical choice (decisions). Not a task list.
- **This backlog** — *work*: status, owner, sequence. Links out to the PRD/ADR for detail.

**Owners:** `AGENT` = VS Code implementation agent · `CTO` = Claude (review + some build) · `JASON` = founder (decisions, deploy, push).

**Maintenance rule (non-negotiable):** this file is updated **in the same change that lands the work** — no separate "update the backlog" task. AGENT updates it on every commit that completes/moves an item; CTO updates it on every review and at the end of each working session. A stale backlog is treated as a bug.

_Last updated: 2026-06-28._

---

## ✅ Done

| Item | Owner | Ref |
|------|-------|-----|
| Phase 0 foundations (pnpm/turbo monorepo, CDK skeleton) | AGENT | `ced8da2` |
| Rename CCHub → Bench, standardise `@bench/*` namespace | AGENT | `226d276`, ADR-0003 |
| Realignment 0–2: agent guardrails, live-site brand tokens, timing-safe compare | AGENT | `b2f2842`, ADR-0004/0005 |
| Canonical docs: PRD v0.5, ADRs 0001–0008, brand tokens, workplans | CTO | `_documentation/` |
| RLS design reviewed & proven on real Postgres (now superseded by 0008) | CTO | workplan review |
| **UI slice** — Collective Dashboard, Add Consultant, 6-step wizard, profile renderer, share view, repository seam | CTO | `apps/web/**` |
| **Data layer live** — DynamoDB deployed (`bench-main`); `@bench/data` implements the contract incl. the `update()` TransactWrite fix; web wired via domain→view mapper | AGENT + CTO | ADR-0008; reviewed/approved |
| **Share link** (no-auth, GSI3 token resolve) · **Create PDF** (portrait/landscape browser-print) · **dashboard completion** ring + avg stat | CTO agents | `apps/web/**` |
| **Admin login** (passwordless magic-link + Web-Crypto signed session + route-protection middleware) · **member invite → claim → wizard** | CTO agents | reviewed/approved |
| **Brand fixes** — real logo (header/footer/share/print), Poppins via `next/font`, gradient reserved for the logo, flat avatars | CTO | `apps/web/**`, `@bench/ui` |

> Note: the Aurora work (`e6e4ab3`, `98c1e4f`, `97d006d` + fixes) is being **reverted** under ADR-0008 — see below.

## Doing / Next — ship the feature push to the live stack

The feature work is built in `apps/web` (fixture-backed, runs locally). Remaining is AWS/deploy (AGENT owns) + a couple of JASON prereqs. Full handoff: `COLLABORATION.md` [CTO] 2026-06-25.

| # | Item | Owner | Detail |
|---|------|-------|--------|
| S1 | **Commit → build/lint green → deploy** the feature push. Set env on the deployed app: `SESSION_SECRET` (strong), `ADMIN_EMAILS=oliver@changeconnected.co.uk`, `DATA_BACKEND=dynamodb`, `BENCH_TABLE_NAME=bench-main`, `AWS_REGION=eu-west-2`. | AGENT | gates everything live |
| S2 | **SES invite/share emails** — verify domain + DKIM; replace the `// TODO(SES)` in `app/login/actions.ts` + `app/profiles/[id]/invite-actions.ts` so the magic link is emailed (not dev-surfaced). | AGENT | PRD §12 |
| S3 | **Server-side PDF** (Lambda + headless Chromium → S3) for one-click branded download with guaranteed fonts — upgrade from the browser-print path. | AGENT | PRD §12 |
| S4 | **Member social login** (Google + LinkedIn-OIDC via Cognito hosted UI) layered onto the existing invite→claim flow; claim binds the social identity to the profile. | AGENT + JASON | PRD §17.1 — needs the OAuth apps (below) |
| S5 | **Photo upload** (S3 presigned + Sharp crop/grayscale) wired to the wizard `headshotAssetId`; renderer resolves the asset URL. | AGENT | PRD §9/§12 |
| S6 | CTO review of S1–S5 as they land. | CTO | gate |

## Auth journey (ACTIVE) — plan: `auth-journey-build-plan.md`, decisions: ADR-0012

The current focused push: godmode Google sign-in + tenant-owner login + an isolation proof, built by
**parallel lanes** (CONTRACT/DATA/INFRA/WEB — see the plan + `COLLABORATION.md`). **Decisions resolved
2026-06-27 (ADR-0012):** Cognito is the V1 identity layer for **owners + godmode** (owners = email/password,
godmode = Google federation, ported from `bndy-serverless-api/auth-lambda`); consultants/clients stay on
magic-link (ADR-0005). ADR-0009 superseded.

**Status (2026-06-27):** **Auth journey functionally complete** — all phases built, **gate-green (179 tests, full monorepo build)**; AJ2a/AJ6/AJ7 + Phase 3 CTO-verified. Remaining: **deploy + run the isolation proof** — see `auth-journey-deploy-checklist.md` (env vars, smoke tests, AJ5 proof). Deferred hardening = the CP rows below.

| # | Item | Lane / Owner | Status |
|---|------|--------------|--------|
| **AJ1** | **Phase 1 — close the loop.** Real `@bench/data` Tenant + User repos (GSI1 `EMAIL#`, `cognitoId`); `getTenantId()`; de-hardcode `PILOT_TENANT_ID`; verify-route `email\|tenantId` claim + user activation; login tenant resolution. | DATA + WEB | ✅ done (G3/G4a/CP1) |
| **OA0** | **Phase 1.5 — Cognito user pool** (Google IdP + email/password). Pool `eu-west-2_QjvjE2Cvl`, client `7c6m3ubjne0u3adejpn58ou8cr`. | INFRA | ✅ deployed |
| **AJ2** | **Phase 2 — godmode Google auth.** `godmode/auth/{google,callback}` routes; validate `@flowency.co.uk` → `platform` session. | WEB | ✅ routes built |
| **AJ2a** | **Phase 2 PROD GAP — OAuth state store.** `apps/web/lib/data/oauth-state.ts` DynamoDB branch throws "not implemented" → godmode Google sign-in fails in production. Implement `OAUTH#state#{token}` + 300s TTL on `bench-main` (create/consume); add a real-path test. | WEB | ✅ done |
| **OA1** | **Phase 3 — owner email/password** (Cognito): magic-link → `/auth/claim` set-password → `bindIdentity`; returning `/login` password sign-in; forgot/reset. CTO-reviewed ✅ (2 minor polish: W-P1 pw-policy match, W-P2 assert user on claim). | WEB | ✅ done |
| **AJ4** | **Phase 4 — SES email.** Sends wired (owner login, godmode login, tenant onboarding). Sender `noreply@opstack.uk` (apex `opstack.uk` identity verified); IAM v2 on `bench-amplify-service-role`. | INFRA + WEB | ✅ done (S2) |
| **AJ6** | **Consultant-invite share menu** — Copy / WhatsApp / Email / SMS + native share sheet. Client-only (shares the existing invite URL); brand + WCAG AA. | WEB | ✅ done |
| **AJ5** | **Phase 5 — isolation proof.** 2nd tenant; prove separation in UI + DynamoDB `TENANT#` partitions. | CTO | ⏳ run on deploy (checklist) |
| **AJ7** | **Tenant-delete cascade (CR2)** — `TenantRepository.delete` must purge the tenant partition; orphaned users still answer `getByEmail`. | DATA | ✅ done (cascade) |

## Multi-tenant control plane (ADR-0010) — godmode + tenant/user RBAC

Turns the single-tenant app into a real multi-tenant SaaS with a platform super-admin. Decisions locked
(ADR-0010); model ported from bndy-backstage. *(The auth-journey items above are the active execution of
G3/G4a/G6/CP1 under ADR-0012; this table remains the fuller control-plane backlog.)*

| # | Item | Owner |
|---|------|-------|
| G1 | `TenantRepository` (create/list/get) + `UserRepository` (create, `getByEmail` via GSI1, `listByTenant`, `setRole`/`setStatus`); MagicLink gains `role`+`email`. | AGENT (`@bench/data`) |
| G2 | CDK: confirm/expose GSI1 `EMAIL#` for user-login lookup; IAM. | AGENT |
| G3 | Session model → `platform` / `tenant{role}` / `member`; replace 27× `PILOT_TENANT_ID` with `getTenantId()` from session. | CTO (`apps/web`) |
| G4 | `/godmode` — platform login + list/create tenants + switch-in. **CTO ✅ foundation built (fixture, additive):** platform session, allowlist, `/godmode` screen, Tenant/User fixture repos. | CTO + AGENT |
| G4a | **Close the loop** (the two blockers stopping a created tenant from working end-to-end): (1) **G3 de-hardcode** — replace 27× `PILOT_TENANT_ID` with `getTenantId()` from the session so switch-in actually scopes the dashboard; (2) **magic-link tenant binding** — verify route must read the link's `email\|tenantId` so a new tenant's admin can claim. | CTO |
| G5 | Per-tenant user management (add portal user, role admin/viewer, send link) + role-gating (viewer read-only) + invite role-binding. | CTO |
| G6 | **JASON:** register a Google OAuth app for godmode (until then godmode bootstraps via magic-link to jason@flowency.co.uk). | JASON |
| G7 | Tenant **suspend/delete** + user **remove** (last-admin guard, type-name confirm, pilot-tenant guard, `[godmode-audit]` stubs). **CTO ✅** (fixture); real cascade + persisted audit-log = follow-ups. | CTO + AGENT |

### Control-plane maturity — what should be there (prioritized)

Standard production multi-tenant SaaS control-plane features (cf. Auth0/WorkOS/Clerk, Stripe/Vercel, AWS
SaaS-Factory) vs Bench today. ✅ have · 🟡 partial · ❌ missing.

**P0 — before any real multi-tenant use (safety + correctness):**

| # | Item | State |
|---|------|-------|
| CP1 | Close the loop — G3 session-tenant + new-tenant admin claim + real `@bench/data` Tenant/User repos | ✅ done (gate-green) |
| CP2 | Persisted **audit log** of every godmode/admin mutation (actor / action / target / before→after / ts / IP), queryable + exportable | ❌ console only |
| CP3 | **Impersonation safety** — "viewing Tenant X as godmode" banner + one-click exit + audit; read-only by default | 🟡 switch-in only |
| CP4 | **Auth hardening** — rate-limit magic-link request/verify; **MFA (or hard restriction) for godmode**; lockout; session revocation | ❌ |
| CP5 | **Soft-delete + retention + restore** for tenants (today delete is an instant purge) | ❌ |

**P1 — mature the admin:**

| # | Item | State |
|---|------|-------|
| CP6 | Tenant **settings/branding edit** + **per-tenant brand resolution** (consume `brandTokens` at render; un-hardcode CC). Decision: **ADR-0013** (shared domain + context detection). Spec'd to DATA+WEB. | 🟡 building |
| CP7 | User lifecycle — resend/revoke invite, deactivate vs delete, **ownership transfer**, last-login | 🟡 |
| CP8 | Platform RBAC — multiple platform admins + a read-only **support** role; allowlist in DB/UI not env | ❌ |
| CP9 | **SES** transactional email (= S2) — ✅ sends wired (apex `opstack.uk` identity + DKIM); per-tenant sender + bounce handling still ❌ | 🟡 |
| CP10 | **GDPR** (PRD §13) — per-tenant export, right-to-erasure, retention purge, consent records | ❌ |
| CP11 | **Observability** — error monitoring (Sentry) + PRD §14 metrics (invite-completion, time-to-complete, share-open) | ❌ |
| CP12 | Tenant metadata — plan/tier/limits, usage counts, status history, tags/notes | ❌ |

**P2 — commercial / enterprise:**

| # | Item | State |
|---|------|-------|
| CP13 | Billing — plans / Stripe / usage metering / quotas + self-serve signup | ❌ PRD P2 |
| CP14 | Enterprise — SSO/SAML + SCIM; custom roles / granular permissions | ❌ |
| CP15 | Data resilience — tested restore, export/import, real `TENANT#` cascade-purge | 🟡 |

## 🐞 Reported issues (Jason — investigate + fix)

| # | Issue | CTO investigation / status |
|---|-------|----------------------------|
| ISS-1 | **No "resend magic link" in godmode.** A pending tenant admin (Adaptavis · `jason@leandevsystems.co.uk` · PENDING) shows Make-viewer / Remove but **no way to re-issue their onboarding/sign-in link**. | **✅ FIXED (CTO, 2026-06-28).** Added `resendAdminInvite(tenantId, userId)` in `godmode/actions.ts` — platform-only, admin-only (defends against handing an admin-scoped link to a viewer); mints a fresh single-use 30-min link (mirrors `createTenant`), best-effort emails it, and **returns the link** so godmode can share it. New `components/ShareLinkActions.tsx` (Copy / WhatsApp / Email / SMS) + `godmode/AdminInviteButton.tsx`, wired into `TenantRow → Manage admins` on each admin row (label: pending → "Send invite link", active → "Resend sign-in link"). Tests: `godmode/__tests__/resend-admin-invite.test.ts`, `godmode/__tests__/AdminInviteButton.test.tsx`. Link semantics match the existing onboarding path, so it stays consistent through the ADR-0014 auth rewrite. |
| ISS-2 | **Brand leak: godmode shows the Change Connected logo.** Godmode is the Flowency/Bench control plane — it must never show a tenant logo. | **✅ FIXED (CTO, 2026-06-28).** New `components/GodmodeHeader.tsx` (Flowency flow-mark + "Bench" wordmark + "Godmode" badge) replaces the `<Logo/>` (hardcoded CC image) in `godmode/page.tsx`. The CC `Logo` component is now orphaned (no importers). Test: `components/__tests__/GodmodeHeader.test.tsx`. |
| ISS-3 | **Brand leak: every `/login` is Change Connected branded** — a new tenant (different email) clicks their invite link and lands on a fully CC-skinned login. | **✅ FIXED (CTO, 2026-06-28).** `/login` reskinned to the OpStack/Bench platform brand: shared `components/BenchMark.tsx` wordmark, `.bench-landing` theme, "Sign in to Bench" + invite-only copy. Removed `PILOT_TENANT`, the CC `<Logo/>`, the CC tagline, and all lime/navy hardcodes (`login/page.tsx`, `LoginForm.tsx`, recoloured `.login-*` in `globals.css`). Pre-auth visitors now always see Bench; tenant skin applies only after auth. Test: `login/__tests__/login-page.test.tsx`. |
| ISS-4 | **Brand leak: `ProfileRenderer` hardcodes "Change Connected" text** → leaks into *every* tenant's profile, share view, and PDF. | **✅ FIXED (CTO, 2026-06-28).** Confirmed and fixed. `ProfileRenderer` now takes a `tenant` prop and renders `TenantLogo` + `instanceName` in the eyebrow and footer (was hardcoded "Change Connected · Change Maker" / CC footer); neutral "Bench" fallback when absent. All 5 callers (share ×2, owner preview, print, wizard) pass the tenant they already resolve. Test: `components/__tests__/ProfileRenderer.test.tsx`. |

> **Verification note (ISS-1–4):** the new Vitest specs couldn't be executed in the Cowork Linux sandbox — the repo's `node_modules` was installed on Windows and lacks the Linux rollup/esbuild native binaries. Static verification (grep: no CC leak in the fixed surfaces; CC `Logo` orphaned; all callers wired) passed. **Run `pnpm --filter web test` locally to confirm green before push.**

### 🔎 Auth audit (ADR-0014) — CTO, 2026-06-28

Verified the passwordless/invite-only rewrite against the **code** (not the plan). **Landed and correct:** invite links no longer create a session on GET — they hold an HMAC-signed pending-invite cookie (httpOnly, sameSite=strict) and redirect to `/login` (`auth/verify/route.ts`); the invite token is burned only on successful binding in `completeAuthentication` (no burn-on-click); social (callback) and phone OTP both route through `completeAuthentication`.

**Found + fixed (test-first):**
- **Email-tab dead-end for a first-time pending admin.** The emailed sign-in link (`type:'signin'`) hit the active-only branch and bounced a still-pending admin to `?error=invalid` — so a resent/onboarding invite could only be completed via social/phone, never email. Fix: when a held pending invite matches the verified email+tenant, the signin branch claims it via `completeAuthentication` (activates pending→active, binds, burns). `app/auth/verify/route.ts`; test `app/auth/__tests__/verify-route.test.ts`. **(This directly affects ISS-1: a resent invite to a *pending* admin now works via the email tab too.)**
- **Latent privilege escalation in `completeWithPendingInvite`.** It minted a `kind:'admin'` session for ANY invite, gating role only for the ADMIN sentinel — a non-admin (consultant) invite would have produced an admin session. Not reachable today (only ADMIN pending invites are ever set) but unsafe. Fix: hard-guard to ADMIN-profile + admin-role *before* any state change; never mint a session otherwise. `lib/auth/complete-auth.ts`; test `lib/auth/__tests__/complete-auth.test.ts`.
- **Stale test reconciled.** `social-auth.test.ts` asserted pre-ADR-0014 callback behaviour (direct `createSession`, `?error=user_not_found`) and omitted `email_verified` → it would fail CI. Realigned to the hardened callback.

**Still open (tracked, not regressions):** phone-only sign-in for a returning user with no invite (needs a phone field on `TenantUser` + GSI); magic-link/OTP **rate-limiting + godmode MFA** (CP4); **`SESSION_SECRET` must be set in every deployed env** (S1) — the dev fallback secret would make the session + pending-invite cookies forgeable in prod if unset.

## 🅿️ Product backlog (parked — placeholders, not scheduled)

| # | Item |
|---|------|
| PB1 | **Rates / Terms on shared profiles — show/hide + dedicated section.** When a consultant profile is shared (magic-link share view **and** PDF), optionally include a **separate, well-laid-out Rates / Terms section**, visually distinct from the profile body. A per-share **show/hide rates** control decides whether it's included at all. The section's content + format depend on **placement type** — e.g. *commission on perm*, *placement fee*, or *day-rate margin* — **TBC by Jason with clients**. NB: the consultant's own `ratesAndPreferences` (day rate, salary, IR35, employment type) already lives on the Profile; PB1 is the **tenant's client-facing commercial terms** for a given share — a different concept. **Placeholder: needs Jason's placement-type model before scoping/building.** |

## 🧩 Open code TODOs

- Durable multi-admin **User** entity — admin auth today = authorised email + valid magic link (no User row). Add when >1 admin is needed.
- `SESSION_SECRET` must be set in every deployed env (dev fallback is intentionally non-secret).
- `@bench/data.update()` — add a DynamoDB-Local integration test for the put-then-delete-orphans path (mock can't catch the TransactWrite same-item constraint).

## 🟠 Pending decisions (JASON)

| Decision | Status |
|----------|--------|
| ADR-0006 hosting (Amplify vs OpenNext) | **Simplified** — the DynamoDB flip removes the VPC constraint, so Amplify is the easy default unless you want OpenNext. |
| ADR-0007 domain/DNS | Partly settled — going live on `bench.opstack.uk`; per-tenant hosting Jason owns. ADRs to be updated to match. |
| Push the local commits to `flowency-live/bench` | Jason to trigger via VS. |

## Definition of done (every work item)

TDD; `pnpm test` green; no `any`; `@bench/domain` stays framework-free; all AWS in `eu-west-2`; tenant-scoping enforced in the repository + proven by tests; **this backlog updated in the same change**; push only after CTO review.

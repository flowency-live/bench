# Bench — Backlog & Status

The single source of truth for **work**: what's done, what's next, who owns it. Updated as work lands.

**Division of docs (so nothing doubles up):**
- **PRD** (`prd-consultant-profile-platform.md`) — *what* we're building (requirements).
- **ADRs** (`adr/`) — *why* we made a binding technical choice (decisions). Not a task list.
- **This backlog** — *work*: status, owner, sequence. Links out to the PRD/ADR for detail.

**Owners:** `AGENT` = VS Code implementation agent · `CTO` = Claude (review + some build) · `JASON` = founder (decisions, deploy, push).

**Maintenance rule (non-negotiable):** this file is updated **in the same change that lands the work** — no separate "update the backlog" task. AGENT updates it on every commit that completes/moves an item; CTO updates it on every review and at the end of each working session. A stale backlog is treated as a bug.

_Last updated: 2026-06-25._

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

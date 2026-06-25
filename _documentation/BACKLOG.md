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
| **UI slice** — Collective Dashboard, Add Consultant, 6-step wizard, profile renderer, share view, repository seam, DynamoDB adapter skeleton | CTO | `apps/web/**` (untracked, fixture-backed) |

> Note: the Aurora work (`e6e4ab3`, `98c1e4f`, `97d006d` + fixes) is being **reverted** under ADR-0008 — see below.

## Doing / Next

| # | Item | Owner | Detail |
|---|------|-------|--------|
| 1 | **DynamoDB flip** — infra revert, `@bench/data`, isolation tests, deploy + smoke | AGENT | ✅ deployed (`bench-main` live, GSI1/2/3), isolation tests green, `@bench/db` removed (ADR-0008). |
| 1a | **Data-contract reconciliation** — CTO ✅ contract in `@bench/types` + web wired to `@bench/data` (mapper + transpile). AGENT ✅ `@bench/data` implements the contract (children, dedup, re-seed, 36 tests) — **reviewed/approved with 1 fix outstanding**. | CTO + AGENT | `data-contract.md`, `COLLABORATION.md` |
| 1b | **Fix `@bench/data.update()` TransactWrite conflict** — delete+put same `SKILL#`/`STORY#` key in one transaction is rejected by DynamoDB; breaks every wizard save. Put-then-delete-orphans; add a DynamoDB-Local test. | AGENT | `COLLABORATION.md` [CTO] 2026-06-25 |
| 1c | Commit the untracked `apps/web/**` UI files | AGENT/JASON | new files not yet in git |
| 2 | Web build + lint **green in CI** | AGENT | task — confirm pre-existing vs regression, then fix or isolate |
| 3 | `pnpm install` (new AWS SDK v3 deps added to `apps/web`) | AGENT/JASON | needed before web build |
| 4 | Wire `getRepository()` → `@bench/data`; replace `PILOT_TENANT_ID` with the Cognito owner session | AGENT | after #1 |
| 5 | Owner auth (Cognito) on portal routes | AGENT | PRD §7 P0 |
| 6 | CTO review of #1 (isolation tests) before UI goes live on real data | CTO | gate |

## 🧩 Open code TODOs (carried from the build)

- `apps/web/lib/data/dynamo-repository.ts` — finalise `update()` write strategy (TransactWrite + delete-then-rewrite children, 25-item BatchWrite chunking); id-collision on `create()`.
- `MagicLinkRepository` skeleton (GSI3 `TOKENHASH#` → returns `tenantId`, per ADR-0005/0008) — not yet written.
- Graduate `ProfileRepository` + view types into `@bench/types`; move the Dynamo adapter into the `@bench/data` package.
- Photo upload (S3 + Sharp), PDF render (Lambda + headless Chromium), SES invite/share emails — P0 surfaces not yet built.

## 🟠 Pending decisions (JASON)

| Decision | Status |
|----------|--------|
| ADR-0006 hosting (Amplify vs OpenNext) | **Simplified** — the DynamoDB flip removes the VPC constraint, so Amplify is the easy default unless you want OpenNext. |
| ADR-0007 domain/DNS | Partly settled — going live on `bench.opstack.uk`; per-tenant hosting Jason owns. ADRs to be updated to match. |
| Push the local commits to `flowency-live/bench` | Jason to trigger via VS. |

## Definition of done (every work item)

TDD; `pnpm test` green; no `any`; `@bench/domain` stays framework-free; all AWS in `eu-west-2`; tenant-scoping enforced in the repository + proven by tests; **this backlog updated in the same change**; push only after CTO review.

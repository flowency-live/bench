# Bench — Realignment Work Order (for implementation agents)

**Audience:** VSCode implementation agent(s).
**Authority:** PRD v0.5 (`prd-consultant-profile-platform.md`) + the ADRs in `adr/`. Where this file
and an ADR appear to differ, the ADR wins — raise it, don't guess.
**Reviewer:** CTO. Every item is TDD and lands as a reviewable commit.

## How to use this

Work top to bottom. Items 0–2 are independent and low-risk; do them first. Item 3 (data store) is
the big one and unblocks 4–5. Tick each acceptance box before opening the next. **Do not** edit
anything under `_documentation/**` and **do not** revert the PRD — it is CTO-maintained and v0.5 is
canonical.

## Context — what's already true

- Monorepo renamed to `@bench/*` (commit `226d276`); 22 tests pass.
- PRD v0.5 is canonical (multi-tenant; Aurora; pooled + RLS). v0.2 is archived/superseded.
- Phase 0 was built against v0.2, so two foundations are **wrong vs the spec**: the data store
  (DynamoDB) and the brand tokens. This work order corrects them.

---

## 0. Apply the guardrail config (do first)

**Why:** the current charter let an agent revert the canonical PRD, and `.claude/CLAUDE.md` still
lists DynamoDB. Fix the guardrails before doing more code.

- Apply the two files in `proposed-claude-config-updates.md` (provided by the CTO) to
  `.claude/agent-charter.yaml` and `.claude/CLAUDE.md`.
- [ ] `_documentation/**` is `cannot_touch` (CTO-maintained, read-only for agents).
- [ ] `.claude/CLAUDE.md` Key Decisions show Aurora + RLS + `@bench` + live-site brand, not DynamoDB.

## 1. Correct the brand tokens — ADR-0004 (quick win)

The live site `changeconnected.co.uk` is the source of truth: navy `#001930`, lime `#BAEB5B`, white
`#FFFFFF`, secondary `#9DADC8`, panel `#002E52`, font **Poppins** (display 900 / body 400). Canonical
set: `graphics-references/brand-tokens.md`.

- `packages/@bench/ui/src/theme/tokens.css` — replace the wrong values (`#0a1929`, `#c5f82a`, Oswald,
  Inter) with the canonical tokens; load Poppins (300/400/600/700/900), self-hosted preferred so the
  PDF renderer (headless Chromium) has the fonts.
- `packages/@bench/types/src/domain/tenant.types.ts` — `DEFAULT_BRAND_TOKENS` must be a **neutral
  platform default**, not Change Connected's. Change Connected's values belong on the **tenant #1
  seed row**, not the product default. Add a tenant-1 seed fixture with the live tokens.
- [ ] Acceptance: rendered surfaces use navy/lime/Poppins; no `#0a1929`/`#c5f82a`/Oswald/Inter remain
  in code; token unit/snapshot tests updated and green.

## 2. Constant-time link comparison — ADR-0005 (quick win)

- `packages/@bench/domain/src/magic-link/link-validation.ts` — `validateMagicLink` compares the
  passcode hash with `!==`. Switch to `crypto.timingSafeEqual` over equal-length buffers (guard
  length first). Keep the function pure.
- [ ] Acceptance: a test asserts mismatched and matching passcodes behave correctly via the new path;
  all magic-link tests green.

## 3. Replace the data store — ADR-0001 + ADR-0002 (the big one)

Replace DynamoDB with **Aurora Serverless v2 (Postgres) + pgvector**, multi-tenant via **RLS**.

- `infrastructure/lib/stacks/bench-data-stack.ts` — remove the DynamoDB table + GSIs. Stand up:
  a VPC (or reuse one) with isolated subnets, an Aurora Serverless v2 Postgres cluster (min ACU low,
  e.g. 0.5), `pgvector` enabled, credentials in **Secrets Manager**, and **RDS Proxy** (or Data API)
  for Lambda connection management. Keep `removalPolicy: RETAIN` and encryption on.
- `infrastructure/bin/bench.ts` — update wiring: `bench-auth-stack.ts` and `bench-api-stack.ts`
  currently consume `dataStack.table`. Replace with the DB connection/secret/proxy handles they need.
- `packages/@bench/types/src/domain/magic-link.types.ts` — fix the "stored in DynamoDB" comment and
  any DynamoDB-shaped assumptions.
- [ ] Acceptance: `pnpm cdk synth` passes; **no `aws-cdk-lib/aws-dynamodb` import remains**; Aurora +
  pgvector + RDS Proxy present; secrets not in code; everything in `eu-west-2`.

> Note: `cdk synth` will still need the dev Route 53 zone to exist (see ADR-0007) — that's a deploy
> dependency, not a blocker for synth of the data stack itself. Confirm the dev domain with the CTO
> (ADR-0007 is still open) before creating zones/certs.

## 4. Schema + migrations with RLS — ADR-0002

- Introduce a migrations tool (e.g. `node-pg-migrate` / Drizzle / Kysely). First migration creates the
  §10 entities (Tenant, User, Profile, Skill, Story, Testimonial, Asset, MagicLink, Event) with a
  non-null `tenant_id` on every tenant-scoped table and an index on `MagicLink.token_hash`.
- Enable **RLS** on every tenant-scoped table with policies keyed off `app.current_tenant_id`.
- [ ] Acceptance: migrations apply cleanly; **cross-tenant negative tests** prove tenant A cannot read
  tenant B even with a raw query; token-hash lookup works via a non-tenant system path that then
  scopes to the resolved tenant.

## 5. Repository layer — ADR-0001/0002

- Thin repository layer behind which `@bench/domain` stays **pure** (no AWS SDK / pg in domain).
- Every request sets the tenant context per transaction (`SET LOCAL app.current_tenant_id = …`) —
  never session-wide (RDS Proxy multiplexes connections).
- [ ] Acceptance: repository unit/integration tests green; domain purity invariant holds; tenant
  context is set on every data path.

## 6. Cleanup

- Remove stale `cchub` strings in generated `infrastructure/cdk.out/**` and `.turbo/cache/**`
  (regenerate), and ensure **both are git-ignored**.
- [ ] Acceptance: `grep -ri cchub` returns only the deliberate dev-domain `cchub.opstack.uk` (pending
  ADR-0007), nothing in source or namespaces.

---

## Definition of done (every item)

- Tests written first; `pnpm test` green; coverage ≥ 80%.
- No `any` (use `unknown`); domain types `readonly`; `@bench/domain` framework-free.
- All AWS resources in `eu-west-2`.
- One focused commit per item with a clear message; **push only after CTO review**. Coordinate on the
  existing uncommitted working-tree changes before committing over them.

---

## CTO review — items 0–3 (2026-06-25): APPROVED with one fix

Items 0–3 are approved and faithful to the ADRs. Fix the one defect below (fold into item 3), then the
4-commit batch is good to push. Items 4–5 are authorized to proceed **with the guardrails below**, and
there is a **review gate after item 4** (migrations + RLS) before item 5 is considered done.

### Must-fix (cheap, do before push)
- **Aurora SG has no egress.** `bench-data-stack.ts` sets `allowAllOutbound: false` on the shared SG
  and adds only an *ingress* rule on 5432. The RDS Proxy ENIs use this same SG, so with outbound denied
  and no egress rule the **proxy cannot reach the cluster** (synth passes, runtime fails). Add a
  self-referencing egress rule on tcp/5432 (and confirm the Lambda→proxy→cluster path), or set
  `allowAllOutbound: true` for the cluster SG since it lives in an isolated subnet. Add a synth/deploy
  smoke test or at least a unit assertion on the egress rule.

### Notes (non-blocking)
- **pgvector isn't enabled yet** — the stack comment says "+ pgvector" but enabling it is a
  `CREATE EXTENSION vector` in the first migration (item 4). Confirm Aurora PG 16.4 supports the
  pgvector version you need. Tracked into item 4 below.
- **`tokens.css :root` ships Change Connected's colours as the global default**, which contradicts the
  file header ("neutral platform default"). For white-label correctness the renderer must inject
  per-tenant CSS variables from `Tenant.brandTokens`; make `:root` the neutral default (or clearly the
  CC theme) so tenant #2 doesn't inherit navy/lime. Fix the comment contradiction at minimum.
- **Poppins via Google Fonts `@import`** — self-host Poppins instead, so the PDF renderer (headless
  Chromium) reliably has the fonts offline and brand continuity doesn't depend on a third-party CDN.
- **Data API and RDS Proxy are both enabled** — pick one access path (Proxy is the one wired to Lambda).
- **1 NAT gateway + a reader instance** — fine for now; revisit NAT HA and whether the reader earns its
  cost for V1 during prod hardening.

### Item 4 — required RLS specifics (read before writing the migration)
RLS is the tenant-isolation boundary; these are the footguns that make it leak:
- **Connect as a non-owner role, or use `FORCE ROW LEVEL SECURITY`.** Table *owners* bypass RLS by
  default — if the app connects as the table owner without FORCE, RLS does nothing. Create a dedicated
  `bench_app` role (not owner, no `BYPASSRLS`) for runtime, and/or `ALTER TABLE … FORCE ROW LEVEL SECURITY`.
- **Policy shape:** `ENABLE ROW LEVEL SECURITY` on every tenant-scoped table; policy
  `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)` **and** a matching `WITH CHECK`
  so inserts/updates can't write another tenant's id.
- **Tenant context:** `SET LOCAL app.current_tenant_id = $1` inside the per-request transaction only —
  never session-wide (RDS Proxy multiplexes/pins connections; `SET LOCAL` is transaction-scoped and safe).
- **Token-hash lookup is the one cross-tenant read** (you resolve tenant *from* the token). Handle it
  with a narrowly-scoped `SECURITY DEFINER` function or a dedicated unrestricted lookup, then set the
  tenant context and proceed — do not disable RLS broadly to make it work.
- **`CREATE EXTENSION IF NOT EXISTS vector;`** in the first migration.
- **Tests are the deliverable:** cross-tenant negative tests against a **real Postgres** (Testcontainers)
  proving tenant A cannot SELECT/UPDATE tenant B even with a raw query and a forged id. Pure unit mocks
  do not satisfy this item.

**Review gate:** stop after item 4 and hand the migration + RLS policies + cross-tenant tests back for
CTO review before building the item 5 repository layer on top.

---

## CTO review — item 4 (RLS): CHANGES REQUESTED (2026-06-25)

The schema and isolation model are right — `tenant_id` everywhere, `ENABLE` + `FORCE` RLS, per-command
policies with `WITH CHECK`, a `SECURITY DEFINER` lookup with `search_path` pinned. I verified the
behaviour against a **real Postgres** (PGlite, since Docker/Testcontainers can't run here). Tenant
isolation passed cleanly (scoped SELECT, forged-id blocked, cross-tenant INSERT blocked by WITH CHECK).
But there is a **production-only defect** plus a robustness gap. Fix both before item 5.

### BLOCKER 1 — the token lookup is broken on Aurora (masked by the test setup)
`lookup_magic_link_by_token_hash` is `SECURITY DEFINER`, so it runs as its **owner**. But every
tenant-scoped table has `FORCE ROW LEVEL SECURITY`, and **FORCE makes the owner subject to RLS too**.
So the function is subject to RLS and, with no tenant context set (exactly when it's called — to
*resolve* the tenant from the token), it returns nothing / throws. Verified: as a non-superuser owner it
throws `invalid input syntax for type uuid: ""` from inside the function.

Why the Testcontainers tests don't catch it: they run migrations as the container's **`postgres`
superuser**, and a superuser bypasses RLS regardless of FORCE — so the function "works" in the test. On
**Aurora the master user is `rds_superuser`, which is NOT a true superuser and does not bypass RLS**, so
in production the function (owned by that role) is subject to RLS → **magic links break**.

**Fix (verified working):** split roles and have the `SECURITY DEFINER` function owned by a role that
bypasses RLS:
- `bench_ddl` — owns schema + the lookup function, `NOSUPERUSER **BYPASSRLS**`. Migrations run as this role.
- `bench_app` — runtime app role, `NOSUPERUSER NOBYPASSRLS`, **non-owner**. The app connects as this.

The app never connects as `bench_ddl`; only the `SECURITY DEFINER` function executes as it (the one
intentional, audited RLS bypass to resolve tenant-from-token). Guard `bench_ddl` credentials tightly.

### BLOCKER 2 — policy cast not robust; fails open-to-error instead of closed
`tenant_id = current_setting('app.current_tenant_id', true)::uuid` throws on an empty/unset GUC
(`""::uuid`) rather than denying. Verified. Use a NULLIF guard so it fails **closed**:
```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```
With the guard, a no-context query returns 0 rows (verified) instead of erroring.

### Required test change (as important as the code fix)
Make the Testcontainers setup mirror production roles: **run the migrations as a non-superuser owner
(`bench_ddl`) and run the assertions as the non-owner `bench_app`.** As written, the suite runs as
superuser and would keep masking this whole class of bug. Also: the 14 RLS tests currently **SKIP** when
Docker is absent — they must **run in CI with Docker**, or the isolation guarantee is unverified.

### Smaller items (fold in)
- Add `UNIQUE` on `magic_links(token_hash)` — the lookup assumes a single row; make it true.
- Decide `tenants`-table access — it has no RLS, so any app role can enumerate all tenants
  (names/domains). Scope it (RLS: a tenant reads only its own row) or restrict reads to a system path.
- `package.json` `migrate` script points at `src/migrations/run.ts`, which doesn't exist — add the
  runner or fix the script.

Evidence (PGlite harness) is in the session outputs: `pgtest/test.cjs` (isolation + the broken lookup)
and `pgtest/fix2.cjs` (the verified two-role + NULLIF fix).

---

## CTO re-review — item 4 fixes: APPROVED (logic) (2026-06-25)

Both blockers are correctly fixed and the test design now mirrors production. Confirmed in code:
- Migrations run as `bench_ddl` (BYPASSRLS) so the `SECURITY DEFINER` lookup function is owned by a
  bypassing role → it resolves tenant-from-token with no context, as intended.
- NULLIF guard on every policy (fails closed); `magic_links.token_hash` is now `UNIQUE`; `tenants` has a
  self-select RLS policy; `run.ts` runner exists.
- Tests run migrations as non-superuser `bench_ddl` and assert as non-owner `bench_app` with `SET LOCAL`
  per transaction — this would now catch the Aurora bug class, not mask it.

**Gate: item 5 (repository layer) is CLEARED to proceed.** Build it to this now-stable contract:
connect as `bench_app`; `BEGIN`; `SET LOCAL app.current_tenant_id = $1`; query; resolve tokens via
`lookup_magic_link_by_token_hash`. Keep `@bench/domain` pure (no `pg`/SDK in domain).

### Must resolve before merge/deploy (new work item — "deploy bootstrap")
These don't change the RLS logic, but the stack won't run on Aurora until they're fixed:
1. **Roles + grants are only in the test harness** (`setupRoles`, `grantAppPermissions`). The production
   path (`run.ts` → `applyMigrations`) never creates `bench_ddl`/`bench_app` and never grants `bench_app`
   table access → the app role would have zero privileges. Move them into the deploy path (privileged
   bootstrap) and add `ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public GRANT
   SELECT,INSERT,UPDATE,DELETE ON TABLES TO bench_app` so future migrations auto-grant.
2. **Extension privilege vs function ownership conflict.** The migration runs `CREATE EXTENSION vector` /
   `uuid-ossp` *and* must leave the lookup function owned by `bench_ddl`. On Aurora, `CREATE EXTENSION
   vector` typically needs `rds_superuser` (the master), which `bench_ddl` is not — but running the whole
   migration as the master makes the function owner the master (no BYPASSRLS), re-introducing the
   original bug. Split it: **extensions + role bootstrap as the master**, **schema + function as
   `bench_ddl`** (or run as master then `ALTER FUNCTION lookup_magic_link_by_token_hash(text) OWNER TO
   bench_ddl`). Verify the `CREATE EXTENSION` privilege on a real Aurora cluster.
3. **Run the RLS suite green in CI with Docker.** It currently skips locally; the guarantee is designed
   but unproven until the 16 tests pass in CI. (Logic independently verified here via PGlite.)

### Minor
- Drop `idx_magic_links_token_hash` — the new `UNIQUE (token_hash)` already creates the index.

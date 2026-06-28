# Auth Journey — Build Plan & Collaboration Model

**Status:** DELIVERED — all phases built + gate-green (179 tests); decisions resolved (ADR-0012). Deploy + verify via `auth-journey-deploy-checklist.md`.
**Owners:** CTO (Claude) · `data` agent · `infra` agent · `web` agent (see §4)
**Supersedes:** the VS Code agent draft `mighty-prancing-diffie.md` (kept verbatim in `archive/` for reference)
**Source of work status:** `BACKLOG.md` — this doc plans *how* we build the auth journey together; the backlog stays the single ledger of *what's done*.
**Last updated:** 27 June 2026

---

## 0. How to use this doc

This is the **plan** (CTO-owned, canonical). It is read-only to agents.

- **Status** lives in `BACKLOG.md` (one ledger, no duplicates).
- **Working logs** live in the repo-root `COLLABORATION.md` (agent-writable), now split by **lane** so multiple agents can work at once without clobbering each other's notes.
- Each agent starts at `COLLABORATION.md`, reads its lane's **Active instructions**, then reads the matching section here for detail. Every completion/blocker is logged back there.

The whole point of the lane split (§4) is that **two or three agents plus the CTO can build in parallel** because each lane owns a disjoint set of files and they meet only at a published interface.

---

## 1. Goal

Get the full authentication journey working end-to-end, on the data store we actually ship on:

1. **Godmode** (Jason, `@flowency.co.uk`) signs in → lists/manages tenants + users.
2. **Tenant owner** signs in → sees only their own consultants.
3. **Isolation proof** — create a second tenant, show the two tenants' data never cross, verified in the UI **and** in DynamoDB (`TENANT#` prefixes).

---

## 2. CTO review of the VS Code agent's plan

**Verdict: good bones, build it — but three of its decisions conflict with locked ADRs and must be settled first (§3), and three factual claims need correcting (below). Phase 1 is correct that it gates everything.**

### What's right
- **Phase 1 gates all else.** Closing the magic-link loop (de-hardcode tenant + tenant-bound claim + `getTenantId()`) is the true unblocker. Correct call.
- The **godmode platform branch is already tenant-less** (`auth/verify/route.ts` lines 42-67) — that half of multi-tenant auth is done and the plan's Phase 1 only needs to fix the **admin** branch.
- OAuth **CSRF state table with TTL** and **server-side email-domain validation** are the right security primitives.
- Phase 5's **isolation proof** is the correct acceptance gate for the whole journey.

### Corrections (claims that don't match the code)
1. **File count is wrong in three places.** The plan says "7 files" (§1.4), "15+ files" (sequencing), and the backlog said "27×". **Actual: 34 `PILOT_TENANT_ID` occurrences across 14 files** (`grep -rn PILOT_TENANT_ID apps/web`). Two of those are *legitimate and stay*: `lib/tenant.ts` (the constant's **definition** — keep it as the pilot/seed default) and `middleware.ts` (route logic). So the de-hardcode targets the **~12 call-site files**, not the definition. Grep is the source of truth, not a fixed number.
2. **The verify-route fix is simpler than written.** The plan says "parse `email|tenantId` from `createdBy`". But `lookupByTokenHash` (GSI3) **already returns the correct `lookup.tenantId`** — the link is self-describing. The real fix is: **delete the `lookup.tenantId !== PILOT_TENANT_ID` line (route.ts:70), trust `lookup.tenantId`, parse only the *email* out of `createdBy` (godmode stashes `email|tenantId`), and activate the pending user on claim.** Don't re-derive the tenant from a parsed string when GSI3 already has it.
3. **`UserRepository.getByEmail()` (Phase 1.2) doesn't exist in `@bench/data`.** Today `@bench/data` has only `profile-repository.ts` and `magic-link-repository.ts`. Tenant/User are **fixture-only** in `apps/web/lib/data`. So Phase 1.2 (resolve an owner's tenant by email) and Phase 5 (query DynamoDB to prove isolation) **cannot run on fixtures** — they need real repos. This is the crux of Decision C (§3).

### Must-fix before merge (non-negotiable, CLAUDE.md)
- **Godmode WCAG.** The proposed muted token `#6b7280` on `#0f0f1a` is **~3.9:1 — fails AA** for normal text (4.5:1 floor). Bump secondary text to **≥`#94a3b8`**. The accent `#f97316` on `#0f0f1a` (~6.6:1) and white body text are fine. Orange borders at 30% opacity must still hit **3:1** where they're the only delimiter.
- **TDD.** The draft has no test-first structure. Every code item below leads with a failing test (First File Rule).

---

## 3. Decisions — RESOLVED 2026-06-27 (ADR-0012)

**Outcome:** **A2 + B2(bndy-port) + C1.** Bench adopts **Cognito as the V1 identity layer for owners and godmode** — Google federation for godmode, email/password for owners — porting the proven `bndy-backstage` pattern (Cognito identities behind our `bench_session` cookie). **Consultants and clients keep their magic-link, link-scoped sessions (ADR-0005) — untouched.** Real `@bench/data` repos are built now (C1). Recorded in **ADR-0012** (supersedes ADR-0009). Phases 2-4 are now unblocked. The original options are kept below for the record.

### Decision A — Tenant-owner auth: passwordless vs Cognito password → **CHOSEN: A2**
> **Jason chose A2 (Cognito email/password for owners).** Phase 3 stays. ADR-0009 superseded by ADR-0012. Magic-link is retained as an owner fallback.

The draft's **Phase 3 adds Cognito email/password for owners.** That contradicts **ADR-0009** ("admin/owner auth = passwordless magic-link for V1") and the CLAUDE.md key decision *"Magic links, not accounts."*

- **A1 (CTO recommended): stay passwordless for V1.** Owners sign in by magic-link only; defer password auth. Zero new infra, consistent with ADR-0009, no Cognito user pool, no SES dependency for login (only for *delivering* the link — Phase 4).
- **A2: add Cognito email/password now.** More familiar login, but pulls in a Cognito user pool, password reset, email verification, and **supersedes ADR-0009**. Bigger surface, re-opens "accounts vs links."

*Note: Jason previously asked "why did we defer Cognito?" — so A2 is a live option, not a strawman. If A2, we write ADR-0012 superseding 0009 and Phase 3 stays; if A1, Phase 3 drops to a V2 backlog item.*

### Decision B — Godmode auth: direct Google OIDC vs Cognito federation → **CHOSEN: port bndy (Cognito federation)**
> **Jason: "we have already implemented it in bndy-backstage."** Inspected: bndy runs a **Cognito-backed** auth (the user carries a `cognitoId`) with a server `/auth/google` endpoint, Google federation, and a server-issued session cookie (multi-provider: Google/Apple/phone-OTP/email-magic). Since Decision A2 brings Cognito in anyway, godmode **shares the Cognito user pool** and we **port the bndy pattern** rather than hand-roll OIDC. Port target: `bndy-serverless-api/auth-lambda/handler.js` (not mounted — Jason grants the agent access). This is effectively B2, implemented bndy-style behind our `bench_session` cookie.

ADR-0010 locked *godmode = Google, `@flowency.co.uk` allowlist*. The draft mixes two ways to do it: §2.1 uses **Cognito `UserPoolIdentityProviderGoogle`**, but §2.3 references **bndy's hand-rolled OIDC handler**. Pick one.

- **B1 (CTO recommended): direct Google OIDC**, porting the proven `bndy-serverless-api/auth-lambda` pattern. Validate the `hd`/email domain, mint our existing `platform` session. No Cognito, fewer moving parts — right-sized for a 1-3 person allowlist.
- **B2: Cognito Google IdP (hosted UI).** Managed, but introduces Cognito for godmode and a hosted-UI redirect. Only attractive if Decision A2 brings Cognito in anyway — then B2 can share the pool.

*A and B are linked: if A1 (no Cognito) then B1. If A2 (Cognito for owners) then B2 becomes coherent.*

### Decision C — Data layer for the journey: real repos vs fixtures → **CHOSEN: C1**
> **Jason chose C1 (real `@bench/data` Tenant + User repos now).** DATA lane builds them in Phase 1; the isolation proof runs against DynamoDB.

The draft's "Data Layer Note" says *"use in-memory fixtures for now, implement DynamoDB later."* But (i) we already deployed DynamoDB (`bench-main`, ADR-0008) and you were firm on not re-introducing in-memory layers, and (ii) **Phase 5's isolation proof queries DynamoDB** — impossible on fixtures.

- **C1 (CTO recommended): build the real `@bench/data` `TenantRepository` + `UserRepository` as part of Phase 1.** They're small — same single-table pattern as the working `ProfileRepository`, with GSI1 `EMAIL#` for `getByEmail`. This makes the auth journey true on the store we ship and unblocks Phase 5. Tracked as **CP1**.
- **C2: fixtures now, real repos later.** Faster to a clickable demo, but Phase 5 can't be proven and we'd re-litigate the DynamoDB decision. If chosen, Phase 5 acceptance changes to "fixture isolation only."

---

## 4. Collaboration model — the lanes

Parallelism is safe because each lane owns a **disjoint** path set and they integrate only at the **`@bench/types` contract** (CTO-published) and at **named env/resource outputs** (infra). This is the same split that worked for Task 1a.

| Lane | Owner | Owns (may edit) | Must NOT touch | Produces (the seam) |
|------|-------|-----------------|----------------|---------------------|
| **CONTRACT** | CTO (Claude) | `packages/@bench/types/**`, `_documentation/**` | — | The `TenantRepository` / `UserRepository` interfaces + types both DATA and WEB build against; ADRs; this plan |
| **DATA** | `data` agent | `packages/@bench/data/**` (repos, seed, tests) | `apps/web/**`, `@bench/domain/**` | `createTenantRepository` / `createUserRepository` implementing the CONTRACT, on `bench-main` (GSI1 `EMAIL#`) |
| **INFRA** | `infra` agent | `infrastructure/**`, `amplify.yml` | `apps/web/**`, `packages/**` | Deployed resources + **documented env var + resource names**: **Cognito user pool (Google IdP + email/password, ADR-0012)**, OAuth state table/TTL, SES domain+DKIM, IAM |
| **WEB** | CTO or `web` agent | `apps/web/**` | `packages/@bench/data/**`, `infrastructure/**`, `@bench/domain/**` | `getTenantId()`, de-hardcoded call sites, verify/login wiring, godmode auth routes + Flowency-branded godmode UI, (if A2) register/reset pages |

**Charter:** none of these lanes touch `@bench/domain/**` (the protected carve-out), so the pre-write guardian stays quiet. If a lane needs to cross into another's paths, it logs a handoff in `COLLABORATION.md` and the owning lane does the edit.

**The interface-first rule:** CONTRACT publishes the Tenant/User repo interface **before** DATA and WEB start coding against it. Then DATA builds the implementation and WEB builds the call sites *concurrently* against the agreed shape — neither waits for the other to finish, exactly as ProfileRepository was done.

---

## 5. Sequencing & parallelism

```
        ┌─────────────────────────── CONTRACT (CTO) ───────────────────────────┐
        │ Publish Tenant/User repo interface in @bench/types  (unblocks DATA+WEB)│
        └───────────────┬───────────────────────────────────┬──────────────────┘
                        ▼                                   ▼
   PHASE 1 — close the loop (GATES ALL ELSE)        these two run in parallel:
   ┌──────────────── DATA ────────────────┐   ┌──────────────── WEB ─────────────────┐
   │ Real TenantRepository + UserRepository│   │ getTenantId() helper                 │
   │ on bench-main, GSI1 EMAIL# lookup      │   │ de-hardcode ~12 call-site files      │
   │ (CP1)  [tests first]                   │   │ fix verify-route admin branch (G4a)  │
   └───────────────┬───────────────────────┘   │ fix login tenant resolution (G4a)    │
                   └──────────► consumed by ───►│ [tests first]                        │
                                                 └──────────────┬──────────────────────┘
                                                                ▼
                                            Phase 1 acceptance (new tenant claims + scoped dashboard)
                                                                │
            ┌───────────────────────────────────────────────────┼───────────────────────────────┐
            ▼                                                   ▼                                 ▼
   PHASE 2 — godmode auth (G6)                       PHASE 3 — owner password (A2 only)   PHASE 4 — SES (S2/CP9)
   INFRA: OAuth state table (+Cognito if B2)         INFRA: Cognito email/pwd            INFRA: domain verify + DKIM
   WEB:   godmode auth routes + Flowency UI          WEB:   register/login/reset         WEB:   wire send in login/godmode actions
            └───────────────────────────────┬───────────────────────────────────────────┘
                                            ▼
                              PHASE 5 — isolation proof (needs C1)
                              create 2nd tenant; prove separation in UI + DynamoDB
```

- **Phase 1 is the only hard gate.** Within it, DATA and WEB run concurrently once CONTRACT publishes the interface.
- **Phases 2, 3, 4 are mutually independent** and can be taken by different agents in parallel once Phase 1 lands. (3 exists only if Decision A2.)
- **Phase 5 needs Decision C1** to be provable against DynamoDB.

---

## 6. Work breakdown (TDD-first), mapped to the backlog

Each item: **test first**, then implement, then the acceptance check. IDs link to `BACKLOG.md`.

### Phase 1 — close the loop · gates all · BACKLOG G3 + G4a + CP1

**CONTRACT (CTO)**
- Publish `TenantRepository` (`get`/`list`/`create`/`setStatus`/`delete`) and `UserRepository` (`create`/`getByEmail` via GSI1/`listByTenant`/`setRole`/`setStatus`/`remove`) interfaces + types in `@bench/types`, mirroring the `ProfileRepository` style. *(This is the handoff seam — do first.)*

**DATA (`data` agent) — CP1**
- `tenant-repository.test.ts` → `tenant-repository.ts`: real single-table impl, `TENANT#{id}` keys, isolation tests.
- `user-repository.test.ts` → `user-repository.ts`: GSI1 `EMAIL#{hash}` for `getByEmail`; last-active-admin guard on `remove`; tenant-scoped `listByTenant`. **Add a `cognitoId` / identity-binding field on the User** (ADR-0012) so the auth callback can link a Cognito identity to the tenant-scoped user.
- Seed: keep `change-connected` + its admin; add a `user` row for the owner so `/login` can resolve the tenant.
- Acceptance: `getByEmail` returns the right tenant; cross-tenant `listByTenant` returns only that tenant's users; all green against the mock (+ a DynamoDB-Local test for `getByEmail`).

**WEB (CTO/`web` agent) — G3 + G4a**
- `getTenantId()` in `lib/auth/session.ts` [test first]: resolves `platform→activeTenantId`, `admin→tenantId`, `member→tenantId`, else `null`. *(Confirm `PlatformSession` carries `activeTenantId` set on godmode switch-in; if not, add it — small CONTRACT/session-token change.)*
- De-hardcode the **~12 call-site files** (grep list) to use `getTenantId()`; leave `lib/tenant.ts` (definition) and `middleware.ts` as-is. [tests assert scoping]
- Fix `auth/verify/route.ts` admin branch: **remove the `PILOT_TENANT_ID` check (line 70)**, trust `lookup.tenantId`, parse the email out of `createdBy` (`email|tenantId`), call `UserRepository.setStatus(active)` on claim. [test: a non-pilot tenant link claims successfully]
- Fix `login/actions.ts`: resolve tenant via `UserRepository.getByEmail` instead of `links.create(PILOT_TENANT_ID, …)`. [test: owner of tenant B gets a link scoped to B]
- **Acceptance (Phase 1):** new tenant admin claims their onboarding link · session has the correct `tenantId` (not PILOT) · dashboard + profile CRUD scope to the session tenant.

### Phase 1.5 — INFRA shared: stand up the Cognito pool (ADR-0012) · gates Phase 2 + 3
- **INFRA:** one Cognito user pool serving **both** surfaces — Google IdP (godmode) **and** email/password (owners) — modelled on `bndy-serverless-api/auth-lambda`. Output pool id / client id / domain / callback URLs to `COLLABORATION.md`. **JASON prereq:** Google OAuth app client id/secret. This is the shared dependency that lets Phase 2 and Phase 3 then run in parallel.

### Phase 2 — godmode auth · BACKLOG G6 · Decision B (Cognito federation, bndy port)
- **INFRA:** OAuth state table (`OAUTH#state#{token}`, 5-min TTL) + IAM; Google IdP on the Phase-1.5 pool; callback URL `https://bench.opstack.uk/godmode/auth/callback`.
- **WEB:** `godmode/auth/google/route.ts` (initiate) + `godmode/auth/callback/route.ts` (validate `@flowency.co.uk`, exchange the Cognito identity for a `platform` `bench_session`) [tests: non-flowency rejected; state mismatch rejected]. `godmode/layout.tsx` + `FlowencyLogo.tsx` + Flowency-branded login — **secondary text ≥`#94a3b8`** (WCAG). Keep magic-link as fallback.
- **Acceptance:** Google button → flowency email → godmode dashboard; non-flowency rejected; magic-link fallback intact.

### Phase 3 — owner email/password · CONFIRMED (Decision A2, ADR-0012) · BACKLOG new item OA1
- **INFRA:** email/password on the Phase-1.5 pool; self-service reset; verification via SES (Phase 4).
- **WEB:** `register` (set password on claim) → `login` password path → `forgot-password` / `reset-password`. The claim binds the Cognito identity to the tenant-scoped User (`cognitoId`, from DATA). [tests first] Magic-link stays as an owner fallback; **consultant/client magic-link paths are untouched (ADR-0005).**
- **Acceptance:** new tenant admin sets a password on first claim · existing admin logs in with email/password · reset works via email · magic-link still works.

### Phase 4 — SES email · BACKLOG S2 / CP9
- **INFRA:** verify `bench.opstack.uk` domain + DKIM; per-tenant sender; IAM. **JASON prereq:** approve domain verification.
- **WEB:** replace `// TODO(SES)` in `login/actions.ts` (and godmode link actions) with a branded send. [test: send invoked with the right recipient/link; dev mode still surfaces `devLink`]
- **Acceptance:** request link in prod mode → email arrives → claim works.

### Phase 5 — isolation proof · needs Decision C1 · acceptance gate
- Create "Acme Corp" + `admin@acme.com` in godmode → claim → empty scoped dashboard → add a profile → switch to Change Connected → Acme profile not visible → `aws dynamodb query` shows `TENANT#acme-corp` vs `TENANT#change-connected` partitions separate.

---

## 7. Branch & integration strategy

- **One branch per lane:** `auth/data`, `auth/infra`, `auth/web` (+ `auth/contract` folds into web/types as it's CTO-only). Disjoint paths ⇒ near-zero merge conflicts.
- **Integration to `main` via PR, after CTO review** (DoD below). WEB merges last in Phase 1 because it consumes DATA's published repos.
- **No force-pushing shared branches.** Each lane rebases on `main` before its PR.
- **Commits:** single-line `type: desc` (CLAUDE.md). The backlog row moves in the same commit that lands the work.

## 8. Definition of done (every item)
TDD; `pnpm test` green; no `any`; `@bench/domain` untouched; tenant-scoping proven by tests; WCAG AA on any UI; `BACKLOG.md` updated in the same change; logged in `COLLABORATION.md`; **pushed only after CTO review.**

## 9. Backlog linkage (no duplication)
Phase 1 = **G3** + **G4a** + **CP1**. Phase 1.5 (Cognito pool, ADR-0012) = **G6 infra prereq / new OA0**. Phase 2 = **G6**. Phase 3 = **new OA1** (owner email/password, ADR-0012). Phase 4 = **S2 / CP9**. Phase 5 = isolation acceptance (**CP15**). Status for all of these lives in `BACKLOG.md`; this doc is the method, not the ledger.

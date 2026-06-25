# ADR-0008: Revert data store to DynamoDB single-table

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **Supersedes:** [ADR-0001](0001-data-store.md) (Aurora + pgvector), [ADR-0002](0002-multi-tenancy-pooled-rls.md) (pooled + RLS)
- **PRD link:** §12 Technical architecture; §10 Data model

## Context

ADR-0001 chose Aurora Serverless v2 + pgvector to keep V1 and the speculative V2 (AI talent
matching) on one store. In practice that decision carries a **rolling cost the pilot can't justify**:
as built, Aurora ran a VPC, NAT gateway, RDS Proxy, a writer + reader at min 0.5 ACU, and managed DB
credentials — on the order of **$100–150/month even idle**. DynamoDB on-demand at pilot scale is
**~$0–5/month** with no idle baseline.

The founder has shipped multiple multi-tenant SaaS products on DynamoDB with app-enforced isolation
and **no cross-tenant leaks**; the pattern is proven and is treated here as a known-good approach, not
a risk to be re-litigated. V2's vector search is speculative and, if it happens, is better served then
by OpenSearch Serverless (or Aurora reintroduced solely for V2 analytics) than by carrying Aurora's
cost through all of V1.

## Decision

Revert the data store to **DynamoDB single-table design** with **application-enforced tenant
isolation**. Authentication to the table is via **IAM** (Lambda execution role) — no database
credentials, no VPC. This restores the Phase 0 design that preceded ADR-0001.

## Tenant isolation model (required)

Isolation is enforced in the application, concentrated so it cannot be bypassed:

1. **Every item key carries the tenant.** Partition keys are prefixed `TENANT#{tenantId}#…`. No item
   exists outside a tenant partition (except the tenant record itself).
2. **The repository layer is the only path to the table.** Handlers/services never touch the
   `DynamoDBDocumentClient` directly — they go through `@bench/data` repositories. Every repository
   method takes `tenantId` as its first argument and builds the tenant-prefixed key; there is no
   method that reads/writes without a tenant scope.
3. **The one global lookup is the token resolver.** `GSI3` (`TOKENHASH#{hash}`) resolves a magic-link
   token to its item — which carries `tenantId` — to establish the scoped session. Every subsequent
   call is tenant-scoped. (This replaces the Postgres `SECURITY DEFINER` function.)
4. **Tests assert scoping on every method.** Repository tests (DynamoDB Local or `aws-sdk-client-mock`)
   prove tenant A cannot read/write tenant B for every access pattern, and that a missing/blank tenant
   yields nothing — never a full-table read.

## Single-table access patterns (blueprint)

Recover these from the original stack design (commit `e6e4ab3~1`,
`infrastructure/lib/stacks/bench-data-stack.ts` docstring):

| Pattern | PK | SK | Index |
|---|---|---|---|
| Get tenant | `TENANT#{id}` | `TENANT#{id}` | — |
| Get user by id | `TENANT#{tid}#USER#{id}` | `USER#{id}` | — |
| Get user by email (login → tenant) | — | — | GSI1 `EMAIL#{email}` |
| Get profile by id | `TENANT#{tid}#PROFILE#{id}` | `PROFILE#{id}` | — |
| List profiles in tenant | `TENANT#{tid}` | begins_with `PROFILE#` | — |
| List profiles by status | — | — | GSI2 `TENANT#{tid}#STATUS#{status}` |
| Skills / stories / testimonial | `TENANT#{tid}#PROFILE#{id}` | `SKILL#{n}` / `STORY#{n}` / `TESTIMONIAL` | — |
| Links / events for profile | `TENANT#{tid}#PROFILE#{id}` | `LINK#{type}#{id}` / `EVENT#{ts}` | — |
| Validate magic link (global) | — | — | GSI3 `TOKENHASH#{hash}` |

Table: `PAY_PER_REQUEST`, PITR on, AWS-managed encryption, stream `NEW_AND_OLD_IMAGES`, `TTL`
attribute, `removalPolicy: RETAIN`.

## Consequences

- **Positive:** ~$0–5/month at pilot vs ~$100–150; no VPC / NAT / RDS Proxy / DB secrets / SQL
  migrations / role bootstrap; Lambdas leave the VPC (faster cold starts); IAM-only auth. The entire
  deploy-bootstrap workstream (former task #7) becomes moot.
- **Negative / accepted:** tenant isolation is app-enforced (mitigated by the model above);
  `pgvector`/relational joins are gone — V2 vector search deferred to OpenSearch or a later store.
- **Follow-up:** supersede ADR-0001/0002 (done in the index), update `.claude/CLAUDE.md` Key Decisions
  back to DynamoDB + app-enforced isolation, close the deploy-bootstrap task.

## What changes (recoverable / net-new / discarded)

- **Recoverable from git (low effort).** Restore the 4 files changed by `e6e4ab3` from `e6e4ab3~1`:
  `infrastructure/lib/stacks/bench-data-stack.ts` (DynamoDB table + GSI1/2/3),
  `bench-api-stack.ts` and `bench-auth-stack.ts` (drop `vpc`/`databaseProxy`/`databaseSecret` props,
  take `table` and grant IAM access), `infrastructure/bin/bench.ts` (wiring). Keep the post-Aurora
  brand-token and type changes.
- **Net-new (~1 day).** A DynamoDB data layer (replace `@bench/db` with `@bench/data`): add
  `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`; implement `ProfileRepository` and
  `MagicLinkRepository` per the patterns above; isolation tests.
- **Discarded.** `@bench/db` Postgres package — migrations (`000-bootstrap`, `001-initial-schema`),
  runner, RLS tests, `tenant-context.ts` (set_config), Kysely/pg deps, pgvector, the two-role/secrets
  model.

## Work order (for the implementation agent — has AWS CLI)

1. **Infra revert.** Restore the 4 infra files from `e6e4ab3~1`; re-apply only the namespace/brand
   deltas if any. Remove VPC/NAT/RDS Proxy/`bench_ddl`+`bench_app` secrets. Grant the API Lambdas
   IAM read/write on the table (least-privilege). `pnpm cdk synth` passes with **no** `aws-rds` /
   `aws-ec2` / RDS-Proxy constructs remaining.
2. **Data layer.** Create `@bench/data` (AWS SDK v3 DocumentClient). Implement the access patterns and
   item shapes above; `@bench/domain` stays pure. Token resolution via GSI3 returns `tenantId`.
3. **Isolation tests.** Prove tenant-scoping on every repository method (DynamoDB Local or
   `aws-sdk-client-mock`); cross-tenant access returns nothing; blank tenant never full-scans.
4. **Remove Postgres artifacts.** Delete `@bench/db`; drop pg/Kysely/testcontainers deps; remove the
   RLS CI job; update workspace + lockfile.
5. **Docs.** Set ADR-0001/0002 status to *Superseded by ADR-0008* (index already updated); update
   `.claude/CLAUDE.md` Key Decisions (DynamoDB single-table + app-enforced isolation).
6. **Deploy + smoke test (AWS CLI).** `cdk deploy` data/auth/api; seed tenant #1 (Change Connected)
   + one sample profile; confirm a tenant-scoped read and a GSI3 token lookup work end-to-end.

### Acceptance
- `cdk synth` clean, no VPC/RDS; DynamoDB table with GSI1/2/3 present.
- Repository isolation tests green in CI.
- Deployed stack reachable; tenant-scoped read + token lookup verified against the real table.

## Alternatives considered

- **Stay on Aurora, cost-optimised** (min 0 ACU scale-to-zero, drop the reader, VPC endpoints over
  NAT) → ~$20–50/month. Rejected: still a standing bill and full VPC complexity for a pilot, when
  DynamoDB is ~$0–5 and simpler.
- **Hybrid (DynamoDB V1 + Aurora later for V2 vector)** — effectively the chosen path: V1 on DynamoDB,
  revisit a vector store only if/when V2 is real.

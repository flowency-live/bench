# ADR-0001: Data store — Aurora Serverless v2 (Postgres) + pgvector

- **Status:** Superseded by [ADR-0008](0008-revert-to-dynamodb.md) (cost) — reverted to DynamoDB
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** §12 Technical architecture; §10 Data model; §17 (V2 supply × demand)

## Context

Phase 0 was built against PRD v0.2, which leaned **DynamoDB single-table**. The committed
`BenchDataStack` is a DynamoDB table with three GSIs, and `.claude/CLAUDE.md` listed DynamoDB as a
locked decision.

PRD **v0.5 supersedes this**. It explicitly resolves the data store to **Aurora Serverless v2
Postgres + pgvector**, stating the choice "supersedes the v0.1 DynamoDB lean" and was "chosen over
DynamoDB to avoid a V2 migration." The drivers:

- The model is naturally relational: Profile → Skills / Stories / Testimonial / Links / Events.
- Multi-tenancy is enforced with **Postgres row-level security** (see ADR-0002) — DynamoDB has no
  native equivalent; it can only fake isolation with `TENANT#` key prefixes.
- V2 needs **semantic matching** (supply × demand) over **pgvector**, plus relational Opportunity
  data. Building V1 on DynamoDB guarantees a disruptive V2 migration — the exact thing v0.5 avoids.

It is all AWS, single account, `eu-west-2` — no change to UK data residency. The DynamoDB footprint
today is **shallow** (the CDK data stack and its wiring only; no repositories or Lambdas depend on
it yet), so switching now is cheap.

## Decision

Use **Amazon Aurora Serverless v2 (PostgreSQL)** as the single transactional store for V1 and V2,
with the **pgvector** extension enabled (reserved for V2 semantic match). Replace `BenchDataStack`'s
DynamoDB table with an Aurora cluster. All access goes through a thin repository layer so domain code
stays persistence-agnostic.

## Consequences

- **Positive:** relational integrity for Profile→children; native RLS tenant isolation; pgvector
  ready for V2 with no migration; one store across V1/V2; trivial token-hash lookup (indexed query).
- **Negative / costs:** Aurora runs in a **VPC** — Lambdas need VPC config or **RDS Proxy** / the
  **Data API** for connection management; minimum-ACU cost when idle (set low, e.g. 0.5 ACU); we own
  schema **migrations** tooling.
- **Follow-up work:**
  - Rewrite `infrastructure/lib/stacks/bench-data-stack.ts` → Aurora Serverless v2 + pgvector (VPC,
    subnet groups, security groups, Secrets Manager credentials, RDS Proxy or Data API).
  - Update `infrastructure/bin/bench.ts` wiring (the API/auth stacks consume `table` today).
  - Introduce a migrations tool (e.g. SQL migrations via `node-pg-migrate`/Drizzle/Kysely) and a
    repository layer; keep `@bench/domain` pure.
  - Update `.claude/CLAUDE.md` Key Decisions (done).

## Alternatives considered

- **DynamoDB single-table (current code)** — fast link lookups, serverless-native, no VPC. Rejected:
  no native RLS, no vector search, forces a V2 migration; contradicts the v0.5 resolution.
- **Hybrid (DynamoDB for link lookups + Aurora for relational/vector)** — rejected for V1 as
  premature complexity; a single indexed Postgres query on the token hash is already trivial.

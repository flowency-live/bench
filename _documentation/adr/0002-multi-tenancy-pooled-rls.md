# ADR-0002: Multi-tenancy — pooled model + Postgres RLS

- **Status:** Superseded by [ADR-0008](0008-revert-to-dynamodb.md) — isolation now app-enforced (DynamoDB `TENANT#` keys)
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** §12 Tenancy; §13 Data protection; §3 Non-goals (self-serve deferred)

## Context

Bench is **multi-tenant from the first migration** (PRD v0.5). Change Connected is tenant #1
("Change Hub"); a second tenant must onboard with its own brand, domain, and terminology and **no
code change**. The hard requirement is that **no query can cross tenants** — a single bug must not
leak one tenant's consultants, profiles, or logs to another (UK GDPR, §13).

The types already carry `tenantId` on every entity, which is the right shape. What was missing is the
**enforcement mechanism**, since the Phase 0 store (DynamoDB) only prefixed keys with `TENANT#`.

## Decision

Adopt the **pooled** isolation model: shared tables, a non-null `tenant_id` on every row, and
**PostgreSQL row-level security (RLS)** as the enforcement boundary. Each request sets the tenant
context on its transaction (e.g. `SET LOCAL app.current_tenant_id = '<id>'`), and RLS policies on
every table restrict reads/writes to the current tenant.

Supporting partitions: Cognito partitions tenants (group or per-tenant app-client); S3 uses a
per-tenant key prefix; each tenant maps to its own brand domain via CloudFront + ACM. A tenant that
demands hard isolation can be **siloed** (schema- or DB-per-tenant) later **without changing the app
contract**.

## Consequences

- **Positive:** cheap, standard, one migration path; defence-in-depth (DB enforces isolation even if
  app code forgets a `WHERE tenant_id`); siloing remains available per tenant on request.
- **Negative / costs:** every connection/transaction **must** set the tenant GUC before queries —
  critical with connection poolers (**RDS Proxy** multiplexes connections, so set tenant via
  `SET LOCAL` inside the transaction, never session-wide); RLS policies needed on all tables;
  test suite must include **cross-tenant negative tests** (tenant A cannot read tenant B).
- **Follow-up work:**
  - Schema: `tenant_id` + RLS policies on every table from the first migration.
  - Request/repository layer: set tenant context per transaction; a non-tenant "system" role for
    cross-tenant ops (token-hash lookup resolves tenant, then scopes).
  - Tests: cross-tenant isolation tests as a standing invariant.

## Alternatives considered

- **Silo per tenant (schema/DB-per-tenant) as default** — strongest isolation, but higher cost/ops
  and slower onboarding. Rejected as the default; kept as an option for tenants who require it.
- **Application-only filtering (no RLS)** — rejected: a single missing predicate leaks data; fails
  the §13 isolation guarantee.

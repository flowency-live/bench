# ADR-0003: Package namespace — `@bench/*`

- **Status:** Accepted (implemented in commit `226d276`)
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** Naming note (Bench = product; Change Hub = tenant #1's instance)

## Context

Phase 0 shipped with a naming split: workspace folders were `packages/@bench/*` but package **names**
were `@cchub/*`, and the root package was `bench`. `cchub` stands for "Change Hub" — which is **tenant
#1's instance name**, not the product. Baking a tenant's branding into the product's package
namespace is the exact anti-pattern a white-label, multi-tenant platform must avoid: it couples the
shared codebase to the first customer.

## Decision

Standardize the internal package scope on **`@bench/*`** (`@bench/domain`, `@bench/types`,
`@bench/ui`). The product is **Bench**. Tenant-specific vocabulary — "Change Hub", "Change Maker",
"Change Hub Admin" — lives **only** in per-tenant configuration and data, never in product code
identifiers, file names, stack names, or types.

## Consequences

- **Positive:** the codebase reads as the product, not as tenant #1; a second tenant introduces no
  naming friction; consistent folder/package/remote naming (`flowency-live/bench`).
- **Negative / costs:** one-time rename across `package.json` names, imports, tsconfig paths, CDK
  stack identifiers, and docs. Low risk — done while the footprint was shallow.
- **Follow-up work (mostly complete):**
  - ✅ Packages renamed `@cchub/*` → `@bench/*`; imports updated; 22 tests pass.
  - ✅ Git remote → `flowency-live/bench`.
  - ⚠️ Residual `cchub` strings remain in generated `infrastructure/cdk.out/**` (stale synth
    artifacts) and `.turbo/cache/**`. These are build output — clean/regenerate; ensure both are
    git-ignored.
  - ⚠️ `cchub.opstack.uk` references are a **domain** choice, not a namespace one — tracked
    separately in ADR-0007.

## Alternatives considered

- **Keep `@cchub/*`** — rejected: couples the product to tenant #1's branding.
- **`@changeconnected/*`** — rejected for the same reason (a tenant name, not the product).

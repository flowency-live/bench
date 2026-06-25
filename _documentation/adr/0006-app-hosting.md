# ADR-0006: App hosting — Amplify Hosting vs OpenNext on Lambda + CloudFront

- **Status:** Proposed (open; non-blocking for data/domain work)
- **Date:** 2026-06-25
- **Deciders:** CTO review, pending Jason
- **PRD link:** §12 App hosting; §15 Open questions

## Context

The Next.js app (portal, wizard, public profile routes) needs SSR hosting. Two candidates:
**Amplify Hosting** (fastest to stand up) vs **OpenNext on Lambda + CloudFront** (more control).

A new constraint emerged from [ADR-0001](0001-data-store.md): Aurora runs in a **VPC**. SSR/route
handlers that talk to the database must reach it — either inside the VPC, or via **RDS Proxy / Aurora
Data API** over an interface endpoint. This nudges the trade-off:

- **Amplify Hosting** SSR compute has historically had limited/awkward VPC access — DB calls may need
  to route through an API tier (API Gateway + VPC Lambda) rather than directly from SSR.
- **OpenNext on Lambda** runs your SSR as Lambdas you can place **in the VPC** directly, aligning
  cleanly with Aurora + RDS Proxy.

## Decision

**Pending.** Recommendation leaning **OpenNext on Lambda + CloudFront** if SSR needs direct DB access,
or **Amplify + a separate VPC API tier** if we keep all DB access behind API Gateway. Decide **before**
wiring the API stack to Aurora so we don't build the data path twice.

## Consequences

- Determines where DB connections originate and how secrets/VPC config are attached.
- Affects the §11 brand-domain/CloudFront setup (ADR-0007).

## Alternatives considered

- See above. To be finalized with the API-tier shape.

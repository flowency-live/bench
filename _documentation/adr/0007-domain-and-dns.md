# ADR-0007: Domain & DNS strategy

- **Status:** Proposed (open; blocking for Route 53 / ACM config)
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO review
- **PRD link:** §11 website continuity; §12 CDN/TLS/DNS; §15 Open questions

## Context

Two questions, plus a Phase 0 artefact:

1. **Layout** — subdomains (`portal.` / `profiles.changeconnected.co.uk`) vs paths on the apex.
   Public share links should sit on the **brand domain** either way (P0 continuity).
2. **Per-tenant mapping** — each tenant maps to its **own brand domain** (Change Connected →
   `changeconnected.co.uk`). How are domains and certs (CloudFront + ACM SANs) managed as tenants are
   added? Blocking once a second tenant onboards.
3. **Phase 0 used `cchub.opstack.uk`** as the working domain (CDK foundation stack, CORS, Cognito
   callbacks). That is a **dev/staging** domain, not the production brand domain. The brand-continuity
   P0 requires production to live on `changeconnected.co.uk`.

Note: `cchub.opstack.uk` is a **domain** decision, deliberately *not* renamed by ADR-0003 (which was
about package namespace). It is fine as a non-prod domain but must not be mistaken for the prod target.

## Decision

**Pending.** Working proposal:

- **Dev/staging:** keep `*.opstack.uk` (rename to `bench.opstack.uk` for consistency, optional).
- **Production (tenant #1):** portal on `portal.changeconnected.co.uk`; public share + wizard on the
  brand domain (`changeconnected.co.uk/p/<token>` or `profiles.changeconnected.co.uk`); assets on
  `assets.changeconnected.co.uk` via CloudFront.
- **Per-tenant:** one CloudFront distribution per brand domain (or SNI + ACM SAN per tenant);
  document the onboarding runbook for adding a tenant domain + cert.

Decide the **dev↔prod split** and **apex vs subdomain** before the next Route 53 / ACM change.

## Consequences

- The Phase 0 CDK foundation stack currently expects a Route 53 zone for `cchub.opstack.uk` (CDK synth
  needs the zone to exist). Confirm whether dev stays on `opstack.uk` before creating zones/certs.
- Interacts with hosting (ADR-0006) for where CloudFront fronts SSR.

## Alternatives considered

- **Apex paths only** — simplest DNS, but mixes portal/admin and public surfaces on one origin.
- **All subdomains** — clean separation; more certs/records to manage per tenant.

# ADR-0013: Tenant brand resolution — shared domain + context detection (V1)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Jason Jones (founder), CTO (Claude)
- **Relates to:** [ADR-0007](0007-domain-and-dns.md) (domain/DNS — supersedes its per-tenant-domain assumption for V1), [ADR-0004](0004-brand-source-of-truth.md) (CC brand tokens), PRD §11 (branding), §12 (multi-tenancy)

## Context

Bench is white-label: each tenant's people and clients must see the **tenant's** brand, never "Bench". But V1 hardcoded the Change Connected brand everywhere (`PILOT_TENANT`, the `@bench/ui` theme, the CC `Logo`), so every tenant — including new ones created in godmode — renders as Change Connected. `Tenant.brandTokens` exists in the model but nothing consumes it.

Two questions had to be settled: **how is a tenant addressed/routed**, and **how is its brand resolved per request**. Jason's call: **shared domain for the pilot** (no per-tenant DNS yet) and **build per-tenant branding now**.

## Decision

In the context of **multi-tenant white-label branding on a single shared domain (`bench.opstack.uk`)**, facing **a hardcoded Change Connected brand and the white-label requirement that customer-facing surfaces look like the tenant**, we decided to **resolve the active tenant from request context and apply its `brandTokens` as CSS variables at render**, and neglected **per-tenant custom domains / subdomains (deferred) and a generic login that "guesses" the tenant**, to achieve **white-label per-tenant look with zero per-tenant DNS/cert work**, accepting **that the shared-domain owner login is Bench-branded until we know the email's tenant, and that per-tenant logos need an upload pipeline (text-wordmark fallback until then).**

### Brand-resolution order (per request)

1. **Logged-in session** → `session.tenantId` (platform/godmode → `activeTenantId`).
2. **Magic-link / share / invite token** → the tenant it resolves to (GSI3), known *before* the page renders.
3. **Host** → reserved for the future per-tenant domain/subdomain model (not used in V1).
4. **None** → the **Bench / OpStack** default brand (the generic `/login` and the marketing site).

### Per-audience outcome

- **Consultants & clients** always arrive via a tokenised link, so they are **tenant-branded from the token** — they never hit the generic login and never see "Bench".
- **Tenant owners/admins** on the shared `/login` see the Bench shell; after email lookup resolves their tenant, the dashboard and everything onward is tenant-branded.
- **Platform**: godmode = Flowency; marketing + generic login shell = Bench / OpStack.

### Applying the brand

- Map `Tenant.brandTokens` → the existing `--color-*` CSS variables on a per-request wrapper (inline `style`), so all existing `var(--color-*)` classes re-skin with no per-component edits (same technique as the godmode `.flowency-godmode` scope).
- Logo: render `logoAssetId` when present; otherwise a **text wordmark of `instanceName`** as fallback. Seed Change Connected with its existing logo + tokens so the pilot is unchanged.

## Deferred (design for, do not build in V1)

- **Per-tenant custom domains / subdomains** — the cleaner white-label routing; revisit when selling beyond the pilot. Host-based resolution (step 3) is reserved for it.
- **Cross-tenant consultant identity** — a person who has profiles across multiple tenants and grants share permission. Requires a **global Consultant identity** separate from the tenant-scoped **Profile** (today profile = tenant-owned). PRD §17 already points here. Keep Profile tenant-scoped for V1; do not couple anything to "one profile per person globally".
- **Per-tenant profile templates / sections** — tenants wanting different profile formats. Keep **one** schema for V1 but keep the profile **data-driven** (sections as data, not hardcoded markup) so a per-tenant template can slot in later. The `Tenant` "default template" slot is reserved for it.

## Consequences

**Good:** white-label look per tenant with no DNS work; reuses the `--color-*` token system (re-skin with one wrapper); CC pilot unchanged; clean upgrade path to per-tenant domains (resolution step 3) and cross-tenant identity (separate the Consultant entity later).

**Costs / risks:** owner login on the shared domain is Bench-branded pre-auth (acceptable); per-tenant **logos** need an upload pipeline — text-wordmark fallback until then; brand resolution runs per request (cache the tenant lookup). WCAG: tenant-supplied colours must be validated for AA contrast on input (brand-settings UI) so a tenant can't ship an unreadable portal.

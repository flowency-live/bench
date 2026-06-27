# ADR-0010: Multi-tenant control plane — godmode, tenant/user RBAC, session routing

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Jason Jones (founder), CTO
- **Expands:** PRD §4 (roles), §12 (tenancy — was "manual provisioning, no UI"), §299 ("single admin per tenant")
- **Reference:** ported *concepts* from `bndy-backstage` (a working multi-tenant SaaS); Bench keeps its own magic-link + DynamoDB + HMAC-session plumbing (cleaner than bndy's Cognito-everywhere).

## Context

The isolation foundation exists (`tenant_id` / `TENANT#` keys, ADR-0008) but the app is **single-tenant
in practice**: `PILOT_TENANT_ID` is hardcoded in **27 places**, the login is Change-Connected-specific,
there are **no Tenant/User repositories**, no platform admin, and no per-tenant RBAC. We need the
**control plane**: a platform super-admin to provision tenants, tenant admins who manage their own
portal users and associates, all via magic-link onboarding.

`bndy-backstage` runs this in production: tenant = a **Membership** record (user→tenant→role
owner/admin/member/viewer), a **`platformAdmin` "godmode"** with a `/godmode` area and a stealth
"switch into any tenant" mode, and **role-bound invites**. We port that model.

## Decisions (locked with Jason)

1. **Routing — one domain.** Everything on `bench.opstack.uk`. The logged-in user's session carries
   `tenantId`; all data scopes to it. The 27 hardcoded `PILOT_TENANT_ID` are replaced by a
   `getTenantId()` that reads the session. (Per-tenant custom brand domains deferred.)
2. **Godmode.** Platform super-admin = **Google sign-in restricted to a `@flowency.co.uk` allowlist**
   (env), identified by the allowlisted email (NOT a per-user DB flag, unlike bndy). A `/godmode` area:
   list + create tenants (company name + first admin email + brand basics), email that admin a magic
   link, and **switch into** any tenant (impersonate, read/manage).
3. **Per-tenant RBAC.** Roles **Admin** (manage portal users, associates, profiles, branding) and
   **Viewer** (read-only). **Any Admin** invites/manages portal users and sets their role. **Associates**
   are the profile subjects — a portal user builds their profile or sends them a self-create magic link.
4. **Identity.** Tenant users onboard by **email magic-link**; social (Google/LinkedIn) layers on later
   (PRD §17.1). Godmode = Google.

## Model (DynamoDB single-table)

- **Tenant** — PK/SK `TENANT#{id}`; `name` (company), `slug`, `instanceName`, `brandTokens`,
  `customDomain?`, `status`, `createdAt`. → new **`TenantRepository`** (create/list/get/update). *(AGENT)*
- **User** — one user belongs to one tenant. PK `TENANT#{tid}#USER#{id}`, SK `USER#{id}`; **GSI1
  `EMAIL#{email}`** (global, for login → resolves tenant + role). Fields `email`, `name?`,
  `role:'admin'|'viewer'`, `status:'pending'|'active'`, `invitedBy`, `createdAt`. → new
  **`UserRepository`** (create, `getByEmail` via GSI1, `listByTenant`, `setRole`, `setStatus`). *(AGENT)*
- **Platform admin** — not stored per-tenant; an allowlisted Google email.
- **MagicLink** — extend to carry the intended **`role` + `email`** so claiming binds the right role
  (ports bndy's role-bound invite). *(minor extension)*

## Sessions (extend the existing `bench_session`)

- `platform` — godmode: `{ kind:'platform', email, activeTenantId? }`.
- `tenant` — `{ kind:'tenant', tenantId, userId, email, role:'admin'|'viewer' }` (replaces today's bare
  `admin`).
- `member` — link-scoped consultant editing their own profile (unchanged).
- Middleware: godmode routes need a `platform` session; tenant routes need a `tenant` session and gate
  by role (viewer = read-only mutations blocked).

## Flows

1. **Godmode → create tenant** (company + admin email) → writes Tenant + admin `User(role admin,
   status pending)` → emails the admin a magic link.
2. **Admin claims link** → `tenant` session (role admin) → dashboard.
3. **Admin → add portal user** (email + role admin|viewer) → writes `User(pending)` → emails a magic
   link → claim → `tenant` session.
4. **Portal user (admin) → add associate** (profile) OR send the associate a self-create magic link
   (the existing add-consultant / send-invite flow, now tenant-scoped + role-gated; viewers can't).

## Consequences

- **Positive:** a real multi-tenant SaaS control plane; one identity/session model; ports a proven shape;
  keeps Bench's magic-link/DynamoDB.
- **Cost:** invasive de-hardcoding (27 sites → session tenant); new repos + GSI1 user index; godmode
  Google auth needs a **Google OAuth app** (Jason) — until then godmode **bootstraps via a magic-link**
  to `jason@flowency.co.uk`; role-gating across the UI.
- **Expands PRD v0.5** (multi-user per tenant + platform admin). PRD §4/§12 to be updated to match.

## Build split

- **AGENT (`@bench/data` + AWS):** `TenantRepository`, `UserRepository` (+ GSI1 `EMAIL` lookup), the
  MagicLink `role`/`email` fields; Cognito Google IdP for godmode (or a lighter OAuth — confirm); SES.
- **CTO (`apps/web`):** session-model extension; replace `PILOT_TENANT_ID` with `getTenantId()`;
  `/godmode` area (Google + allowlist, tenant CRUD, create-admin + send-link, tenant switch); per-tenant
  user-management UI; role-gating (viewer read-only); invite role-binding. Fixture Tenant/User stores so
  local dev works with no AWS.

## Alternatives

- **Subdomain / custom-domain routing** — deferred (chose single-domain/session routing).
- **Membership-join (a user in many tenants, like bndy)** — deferred; Bench users belong to one tenant
  (simpler). Revisit if a person must span tenants.

## Not ported from bndy

Cognito-everywhere, Amplify proxy, the artist/song/event domain. bndy is a reference for the
role/session/godmode *model*, not the implementation.

# PRD — Bench

**Product:** Bench *(working name)* — a multi-tenant, white-label platform for consultancies to build, manage, and share branded consultant profiles.
**Author:** Jason Jones
**Status:** Draft v0.6
**Platform:** AWS, single account, `eu-west-2` (London) for UK data residency
**Last updated:** 25 June 2026

---

> **Naming.** **Bench** is the product — the platform we build and (later) sell to multiple consultancies. Each client is a **tenant** that brands its own instance. **Change Connected is the first client (tenant #1); they call their instance the "Change Hub."** So "Change Hub", "Change Maker (CM)" and "Change Hub Admin (CHA)" are *Change Connected's vocabulary*, not Bench's — Bench treats the instance name and these role labels as per-tenant configuration. This document uses Change Connected's terms when describing the pilot, and "Bench / tenant / CM / CHA" generically elsewhere.

## 1. Problem statement

A consultancy presents its people to clients as profiles — who they are, what they're good at, and the impact they've delivered. Today that's a manual job: someone hand-builds a deck per consultant, chases the consultant for input over email, and the output drifts off-brand and out of date the moment it's saved. Sharing with a client is ad-hoc — a PDF attached to an email, no control over who it reaches, no idea whether it was opened.

The cost is owner time and credibility. Every profile is bespoke effort, every refresh is a re-do, and inconsistent profiles undermine the brand the consultancy is selling on.

Bench turns the profile into structured data, lets the consultant fill it in themselves through a guided wizard, renders it on-brand automatically, and gives the consultancy controlled links to put specific profiles in front of specific clients. Change Connected is the pilot tenant, running their instance as the "Change Hub".

## 2. Goals

1. **Cut owner time per profile from hours to minutes** — the owner adds a consultant and sends a link; the consultant does the input.
2. **Get profiles completed without chasing** — a consultant can finish a profile in one sitting, no account, no password, resumable.
3. **Every profile is on-brand by construction** — branding is applied at render from shared tokens, not re-created per profile.
4. **Owner controls client distribution** — share a specific profile with a specific client via a link that can expire and be revoked, with basic open tracking.
5. **One source of truth** — update once, every shared link reflects the change.

## 3. Non-goals (this version)

- **Self-serve tenant sign-up and billing** — the platform is **multi-tenant by design** (see §12); Change Connected is the first pilot tenant. Tenants are onboarded manually during the pilot. Public sign-up, plans, and billing are deferred (P2/V3). The multi-tenant *foundation* — tenant scoping, isolation, per-tenant branding — is in scope from v1.
- **Consultant marketplace / public availability / rates** — not a staffing exchange. No public availability feed, no booking, no day-rate or billing logic, no client-facing availability. *Note:* V1 does track availability **internally** for the owner's own talent-pool management (the `availability` axis — see §5 and ADR-0011); that data is owner-only and never appears on a client share view. The non-goal is the *marketplace*, not the internal field.
- **Client accounts** — clients view via link only. No client login, dashboards, or shortlists in v1.
- **CRM / ATS integration** — no sync to Salesforce, Bullhorn, etc. Manual for now.
- **E-signature, contracting, or DOR­A/compliance attestations** on profiles — out of scope; this is a presentation tool, not a contracting one.
- **Rebuilding or migrating the marketing site** — `changeconnected.co.uk` stays where it is. This product lives alongside it on the brand domain and inherits its look; it does not replace it.

## 4. Roles & permissions

| Capability | Owner | Consultant (invite link) | Client (share link) |
|---|---|---|---|
| Log in to portal | ✅ | ❌ | ❌ |
| See all profiles | ✅ | ❌ | ❌ |
| Add / remove a consultant | ✅ | ❌ | ❌ |
| Edit any profile | ✅ | own only | ❌ |
| Complete profile via wizard | ✅ | own only | ❌ |
| Publish a profile (set Active) | ✅ | ❌ | ❌ |
| Set a consultant's availability | ✅ | own only | ❌ |
| Generate invite link | ✅ | ❌ | ❌ |
| Generate / revoke client share link | ✅ | ❌ | ❌ |
| View an Active profile | ✅ | own only | ✅ (scoped) |

Consultant and Client are **link-scoped sessions**, not user accounts — a magic link grants a short-lived session limited to one profile and one action.

## 5. Profile lifecycle

A profile is modelled on **two independent axes** (see ADR-0011): a `status` lifecycle (is the profile ready?) and an `availability` position (can we pitch this person, and when?). They move independently — a profile can be **Active** + **Engaged**, or **In progress** + **Available**.

### Axis 1 — Status (profile lifecycle)

```
No profile ──opens wizard──▶ In progress ──owner publishes──▶ Active ──owner removes──▶ Removed
```

- **No profile** — owner created the record (name + email), nothing filled in.
- **In progress** — consultant has opened the wizard and is filling it in; auto-saving.
- **Active** — owner has published it; live, visible in the Collective, and eligible for client share links.
- **Removed** — deactivated / archived; hidden from the Collective, links dead, data retained.

Whether an invite link exists is a property of the **link** (`MagicLink`), not the profile, so there is no separate "Invited" status. Client share links can only be created against an **Active** profile.

### Axis 2 — Availability (market position — owner-internal)

Owner/associate-set, never shown on client share views.

- **Available** — free to be pitched now.
- **Looking** — open but currently committed; a **notice period** (immediate / 1 week / 2 weeks / 1 month / 3 months / 6 months) says how soon they can move.
- **Engaged** — on an assignment; an **end date** says when they roll off.
- **Pitched** — put forward on an opportunity; awaiting outcome.

## 6. User stories

### Owner
- As the **owner**, I want to log in and see every consultant profile with its status, so I know at a glance what's done, in progress, or stalled.
- As the **owner**, I want to add a consultant with just their name and email, so I can get them started in seconds.
- As the **owner**, I want to send a consultant a link to complete their own profile, so I'm not transcribing their CV into a deck.
- As the **owner**, I want to review and edit a profile before publishing it, so nothing off-brand or wrong reaches a client.
- As the **owner**, I want to mark each consultant's availability (available, looking with a notice period, engaged with an end date, or pitched), so I know at a glance who I can put forward and when.
- As the **owner**, I want to generate a link to share one specific profile with one specific client, so I control who sees whom.
- As the **owner**, I want to set an expiry on a client link and revoke it, so a profile can't circulate indefinitely.
- As the **owner**, I want to see whether a client link has been opened, so I can follow up at the right moment.
- As the **owner**, I want to re-issue an expired invite, so a consultant who didn't finish can pick up where they left off.

### Consultant
- As a **consultant**, I want to open a single link and start filling in my profile with no sign-up, so there's no friction.
- As a **consultant**, I want my progress saved automatically and to resume on the same link, so I can stop and come back.
- As a **consultant**, I want to upload a photo and see my profile rendered as it'll actually look, so I trust the output before submitting.
- As a **consultant**, I want clear guidance on each section (what a good impact story looks like), so I produce strong content, not waffle.

### Client
- As a **client**, I want to open a link and immediately see a clean, branded profile, so I can assess the consultant without downloading or signing up.
- As a **client**, I want to view it on my phone and optionally save a PDF, so I can forward my recommendation internally.

### Edge / empty / error states
- As a **consultant**, when my link has expired, I want a clear message and a way to request a fresh one, not a dead page.
- As the **owner**, when a consultant hasn't started after N days, I want the Collective Dashboard to flag it, so I know to nudge.
- As a **client**, when a link has been revoked or expired, I want a neutral "this profile is no longer available" page, not an error.

## 7. Requirements

### P0 — Must have (v1 ships without these = it doesn't solve the problem)

**Owner authentication**
- Owner logs in via Amazon Cognito (Google federation and/or email). Sessions are signed and short-lived.
- Acceptance: Given a registered owner, when they authenticate, then they reach the Collective Dashboard; unauthenticated requests to portal routes redirect to login.

**Brand & website continuity**
- Every Bench surface — portal, wizard, share view, and every error/landing page — renders in the **tenant's** brand system (logo, colour tokens, fonts, heading style) and lives on the tenant's brand domain, so no one is ever handed off to something that looks like a third-party tool. For Change Connected that's the navy/lime/gradient system, Fredoka/Poppins, and `changeconnected.co.uk`.
- Public-facing pages (share view, wizard) carry the tenant's header and footer treatment.
- Acceptance: Given any consultant or client opening a link, when the page loads, then it sits on the tenant's brand domain (Change Connected → `changeconnected.co.uk`), shows that tenant's logo and footer, and is visually indistinguishable from an extension of their main site.

**Collective Dashboard**
- The owner's view of the Collective — the tenant's talent pool / portfolio. List of all profiles showing headshot, name, role, **status** (lifecycle), **availability** (with notice period / end date), last updated; search by name; filter by status.
- Acceptance: Given profiles in mixed states, when the owner opens the dashboard, then each profile shows its current status and availability, and the list is searchable and filterable by status.

**Add consultant**
- Owner creates a profile with name + email (role optional). Creates a **No-profile** record.
- Acceptance: Given valid name and email, when the owner submits, then a No-profile record is created and appears in the Collective; duplicate email warns but doesn't block.

**Invite magic link (owner → consultant)**
- Owner generates an invite link scoped to one profile; system can email it via the consultant's address; link is resumable until submit or expiry.
- Acceptance: Given a No-profile record, when the owner generates an invite, then a single-purpose tokenised URL is produced; opening it starts/resumes the wizard scoped to that profile only and moves the profile to **In progress**.

**Completion wizard (consultant)**
- Stepwise form mapping to the profile sections (see §9), with auto-save, inline guidance, photo upload, live preview, and submit.
- Acceptance: covered by §9 acceptance criteria.

**Profile renderer**
- Renders structured profile data through brand tokens into the branded one-pager, responsive on web, with print-to-PDF (A4 landscape and portrait).
- Acceptance: Given a complete profile, when rendered, then it matches the brand (navy/lime/gradient, logo, Fredoka/Poppins) and prints to a single A4 page in both orientations; all text meets WCAG 2.1 AA contrast.

**Owner review & publish**
- Owner can edit any field of a profile and publish it. (Submitting the wizard notifies the owner it's ready; the owner edits freely and decides when to publish — there is no separate locked "submitted" status.)
- Acceptance: Given an In-progress profile, when the owner edits and publishes, then status → Active and the profile becomes shareable.

**Client share link (owner → client)**
- Owner generates a share link against an Active profile, with an expiry and a revoke control; opening it shows the read-only profile. The client view never exposes the consultant's availability (owner-internal).
- Acceptance: Given an Active profile, when the owner creates a share link with a 30-day expiry, then the client sees the profile (without availability) until expiry or revoke; after either, the link shows a neutral unavailable page.

**Audit trail**
- Record link creation, send, first open, and revoke for invite and share links.
- Acceptance: Given any link event, when it occurs, then it's logged with timestamp and link id and is visible on the profile.

### P1 — Should have (fast follows)

- **Share open tracking surfaced on the dashboard** — "opened 2 days ago", view count per share link.
- **Per-share passcode** — optional short code the client must enter (defence for forwarded links).
- **Re-issue / resend** controls for expired or unopened invites in one click.
- **Brand settings UI** — owner edits brand tokens (colours, logo, fonts) instead of them being hardcoded.
- **Profile templates** — variant layouts per profile type (e.g. Change Impact vs Delivery Lead) sharing one renderer.
- **Bulk invite** — add and invite several consultants from a paste/CSV.

### P2 — Future considerations (design for, don't build)

- **Self-serve tenant onboarding and billing** — the multi-tenant foundation ships in v1; public sign-up, plans, and billing come later.
- **Client view** — a light client space holding multiple shared profiles (a shortlist).
- **CRM/ATS sync** for consultant records and share activity.
- **Profile versioning / history** with rollback and "what the client saw on date X".
- **Analytics** — section-level engagement on shared profiles (time on testimonial, etc.).

## 8. Magic-link mechanics

This is the spine of the product, so it's specified rather than assumed.

**Two link types, both single-purpose and scope-bound:**

| | Invite link | Share link |
|---|---|---|
| Audience | Consultant | Client |
| Grants | Edit one profile via wizard | Read one published profile |
| Lifetime | Resumable until submit; default expiry 14 days, re-issuable | Owner-set: 7 / 30 / 90 days or no-expiry-with-revoke |
| Reuse | Reusable within lifetime (resume) | Reusable within lifetime |
| Revoke | On submit, or owner revoke | Owner revoke any time |

**Token & session model**
- Token = 32 bytes from a CSPRNG, URL-safe base64. The raw token lives only in the URL.
- Store only a **hash** of the token server-side (SHA-256), alongside: type, target profile id, scope, expiry, status, created-by, created-at.
- On open: validate hash + expiry + status, then mint a **short-lived signed session cookie** scoped to that profile + action (not a full account session). Session TTL short (e.g. 2h) and re-derivable from the still-valid link.
- Rate-limit link validation and minting; lock out after repeated invalid tokens.
- Revocation flips status to `revoked`; validation fails closed.
- All link routes are no-index, no-cache, and never expose the profile id in a guessable way (the token is the only handle).

*Reference: this mirrors the auth pattern already proven in belterpoc (magic-link email + signed session cookies); reuse rather than rebuild.*

## 9. Completion wizard spec

Steps map one-to-one to the rendered profile. Counts are ranges so the layout stays balanced.

1. **Identity** — full name, role/strapline (the eyebrow + name + role line). Photo upload with crop; brand treatment (grayscale + gradient ring) applied at render, so the consultant just uploads.
2. **Positioning** — a short headline ("Driving value from strategy to execution") + a 40–70 word bio paragraph. Guidance + character counter; "make it punchy" examples, no AI auto-rewrite (consultant's own words).
3. **Core skills** — 3–6 items, each a title + 1–2 sentence description. Drag to reorder.
4. **Impact stories** — 3–5 items, each: client/context tag (the chip), title, and a 1–3 sentence outcome. Prompt for a number or before/after where possible ("15k cabin crew, ten hours → two seconds").
5. **Testimonial** — quote + attribution (name, role, company). Optional in v1.
6. **Review & submit** — live full-page preview (landscape + portrait toggle); consultant confirms and submits.

**Wizard acceptance criteria**
- [ ] Each step auto-saves on blur; closing and reopening the link restores all input.
- [ ] Required fields per step are validated before advancing; the consultant can move backwards freely.
- [ ] Photo upload accepts JPG/PNG, enforces a min resolution, and shows the cropped brand-treated result.
- [ ] Skills and stories enforce min/max counts and reorder by drag.
- [ ] The live preview reflects current data and the active brand at all times.
- [ ] Submit notifies the owner the profile is ready to review; the owner can still edit and is the one who publishes it to Active (no locked "submitted" state).
- [ ] An expired link shows a clear "request a new link" path, not an error.

## 10. Data model (entities)

- **Tenant** — id, name, **instance display name** (e.g. "Change Hub"), brand tokens (colours, logo asset, fonts), custom domain, **terminology overrides** (labels for the CM / admin roles), default profile template, status. **Every other entity below carries a `tenant_id`** and is isolated by it. Change Connected is the first tenant row. *(Isolation in §12.)*
- **User** — tenant-scoped owner(s)/CHA; id, email, auth provider.
- **Profile** — id, tenant id, consultant name, email, role, **status** (`no_profile` / `in_progress` / `active` / `removed`), **availability** (`{ status: available | looking | engaged | pitched, noticePeriod?, endDate? }` — owner-internal, never on client views), headshot asset, positioning (headline, bio), timestamps. *(Status + availability model: ADR-0011; canonical enums in `apps/web/lib/types.ts`.)*
- **Skill** — id, profile id, title, body, order.
- **Story** — id, profile id, client tag, title, body, order.
- **Testimonial** — id, profile id, quote, author name, author role, author company.
- **Asset** — id, profile id, type (headshot), original + processed renditions, dimensions.
- **MagicLink** — id, profile id, type (invite|share), token hash, scope, expiry, status, passcode hash (P1), created-by, created-at.
- **Event** — id, link id / profile id, kind (created|sent|opened|revoked|published), actor, timestamp.

## 11. Branding, rendering & website continuity

- Each tenant's instance reads as an **extension of that tenant's own website**, not a separate app — for Change Connected (the "Change Hub"), an extension of `changeconnected.co.uk`. Shared header and footer, the same logo (transparent-keyed), the same type and colour, the same heading style. A client following a share link should feel they never left the site.
- Profiles render from **brand tokens**, not per-profile styling: navy `#001930`, lime `#BAEB5B`, gradient `#73EB73 → #37ACED`, transparent-keyed logo, Fredoka (display) + Poppins (body). **Brand tokens live on the Tenant record from v1** — the renderer themes per tenant. Change Connected's tokens are simply the first tenant's set; a second tenant brings its own logo, colours, fonts, and domain with no code change.
- All three surfaces — portal, wizard, profile renderer — consume one **shared theme/component package** (reuse the existing Flowency/Change Connected design-system work: CSS tokens, Tailwind theme extension, React/TS components) so brand changes propagate everywhere from one place.
- One renderer, two paper layouts (A4 landscape and portrait), plus a responsive web view. Print path produces a single-page PDF per orientation.
- WCAG 2.1 AA contrast is a render-time guarantee, not a per-profile check — token pairs are validated once.

## 12. Technical architecture (AWS)

Everything runs in one AWS account in `eu-west-2` (London). Infrastructure as code in **AWS CDK (TypeScript)** to match the app stack.

**Tenancy.** Bench is multi-tenant from the first migration; Change Connected is tenant #1 (instance name "Change Hub"). Each tenant carries its own brand tokens, instance display name, role-label terminology, and domain. Default isolation model is **pooled** — shared tables with a `tenant_id` on every row, isolation enforced by **Postgres row-level security (RLS)** so no query can cross tenants. Cognito partitions tenants (groups or per-tenant app-client), S3 uses a per-tenant key prefix, and each tenant maps to its own brand domain via CloudFront + ACM. A tenant that demands hard isolation can be **siloed** (schema- or DB-per-tenant) without changing the app contract. Tenant provisioning is a manual operator task during the pilot — no self-serve.

Service mapping:

| Concern | Service | Notes |
|---|---|---|
| App hosting (Next.js) | **Amplify Hosting** (or OpenNext on Lambda + CloudFront) | SSR for the portal, wizard, and public profile routes |
| Tenant isolation | **Pooled — `tenant_id` on every row + Postgres RLS**; per-tenant Cognito partition, S3 prefix, brand domain | Siloed (schema/DB-per-tenant) available for any tenant needing hard isolation |
| CDN / TLS / DNS | **CloudFront + ACM + Route 53** | Brand domain; no-cache + no-index on link routes; cache static assets and rendered profiles |
| Owner auth | **Cognito** (Google federation + email) | Managed; hosted or custom UI |
| Link-scoped sessions | **Lambda + KMS-signed JWT**, validated by an **API Gateway Lambda authorizer** | Consultant/client are not Cognito users — they get scoped, short-lived signed sessions |
| API | **API Gateway (HTTP API) + Lambda** | Or the Next.js API layer; Lambda authorizer enforces scope |
| Data | **Aurora Serverless v2 (Postgres) + pgvector** | Relational fits Profile→Skills/Stories and (V2) supply×demand; pgvector reserved for V2 semantic match. Token-hash lookup is a trivial indexed query. Chosen over DynamoDB to avoid a V2 migration |
| Assets | **S3 + CloudFront**; **Lambda (Sharp)** for crop/grayscale/resize | Headshot originals + processed renditions |
| Email | **SES** (London region, domain + DKIM verified) | Invite and share emails |
| PDF | **Lambda + headless Chromium** (Puppeteer/Playwright) renders the profile route to a single-page A4 PDF | Server-side render guarantees Fredoka/Poppins load; output to S3, served via CloudFront |
| Secrets / signing | **Secrets Manager + KMS** | Token-signing keys never in code |
| Rate limiting / bot defence | **WAF + API Gateway throttling** | Protects public share and link-validation routes |
| Audit / events | **Aurora** event log, optional **EventBridge** fan-out | Backs the audit trail (§7) |
| Logs / metrics | **CloudWatch** | Dashboards for the success metrics in §14 |

This resolves the v0.1 open questions on email (SES), PDF generation (Lambda headless Chromium), and data residency (London region). It reuses the proven belterpoc auth pattern (magic-link + signed session cookies) rather than rebuilding it — implemented here on Lambda/KMS/DynamoDB.

## 13. Data protection (UK GDPR)

Profiles hold consultant PII (name, email, photo) and client view logs. Build in from v1:
- **Lawful basis & consent** — consultant agrees to their profile being shared with clients at submit; record the consent event.
- **Retention** — archived profiles and link logs retained for a defined period, then purged; document it.
- **Right to erasure** — owner can hard-delete a profile and its assets/logs on request.
- **Tenant isolation** — every record is scoped by `tenant_id` and enforced by Postgres row-level security; no tenant can read another's CMs, profiles, or logs. Storage (S3 prefixes) and identity (Cognito) are partitioned per tenant.
- **Data residency** — entire stack pinned to `eu-west-2` (London): S3, Aurora, SES, Lambda. No data leaves the UK region (matters for regulated clients).
- **Minimisation** — share links expose only the rendered profile, never the underlying record or other profiles.

## 14. Success metrics

**Leading (days–weeks)**
- Invite completion rate — % of invited consultants who reach Submitted. Target ≥ 70% within 7 days of invite.
- Time-to-complete — median wizard start → submit. Target < 20 minutes.
- Owner time per profile — add → publish, owner-side only. Target < 10 minutes.
- Share open rate — % of client links opened. Target ≥ 60%.

**Lagging (weeks–months)**
- Profiles maintained — % of published profiles updated at least once after first publish (proxy for "single source of truth" actually being used).
- Profiles shared per client engagement.
- Owner-reported reduction in deck-building effort (qualitative, first quarter).

## 15. Open questions

Resolved since v0.1: email → **SES**; PDF → **Lambda headless Chromium**; residency → **`eu-west-2`**; owner auth → **Cognito**. Still open:

- **Data store** *(resolved)* — **Aurora Serverless v2 Postgres + pgvector**, decided so V1 and V2 share one store (V2 needs relational supply×demand and vector search). Supersedes the v0.1 DynamoDB lean.
- **App hosting** *(eng)* — Amplify Hosting vs OpenNext on Lambda + CloudFront. Amplify is faster to stand up; OpenNext gives more control. *Non-blocking.*
- **Domain layout** *(owner/eng)* — subdomains (`portal.` / `profiles.changeconnected.co.uk`) vs paths on the apex. Public share links should sit on the brand domain either way. *Blocking for DNS/cert setup — pick before Route 53/ACM config.*
- **Tenant isolation model** *(eng)* — pooled + RLS for all (cheap, standard) vs siloed schema/DB for tenants demanding hard isolation. Leaning pooled + RLS as default, siloed on request. *Non-blocking — RLS is the default.*
- **Tenant → domain mapping** *(eng/owner)* — each tenant on its own brand domain (Change Connected on `changeconnected.co.uk`); how domain mapping and certs (CloudFront/ACM SANs) are managed as tenants are added. *Blocking once a second tenant onboards.*
- **Marketing site source** *(eng)* — what is `changeconnected.co.uk` currently built on, and can its header/footer markup be reused directly, or do we rebuild the shell to match? Determines how literal "extension of the site" can be. *Blocking for the continuity requirement.*
- **Share default lifetime** *(owner)* — sensible default expiry, e.g. 30 days? *Non-blocking.*
- **Passcode in v1 or P1?** *(owner)* — leaked-link risk vs friction. Currently P1; confirm acceptable for first client shares. *Non-blocking.*
- **Multiple owners / seats** *(stakeholder)* — single owner in v1, or Cognito group with seats from the start? Assumed single. *Non-blocking.*

## 16. Phasing

- **Phase 0 (foundations):** AWS account hardening, CDK skeleton, **multi-tenant data model (`tenant_id` + Postgres RLS) from the first migration**, Route 53 + ACM on the brand domain, shared brand/theme package, SES domain verification.
- **Phase 1 (v1, P0):** owner auth (Cognito), Collective Dashboard, add consultant, invite link, wizard, renderer (web + PDF via Lambda), review/publish, client share link with expiry + revoke, audit trail, full brand continuity. **Change Connected onboarded as the first (pilot) tenant via per-tenant brand tokens.**
- **Phase 2 (P1):** share open tracking on dashboard, passcodes, re-issue/resend, brand settings UI, templates, bulk invite.
- **Phase 3 (P2):** self-serve tenant onboarding + billing (foundation already shipped in v1), client shortlists, CRM/ATS sync, versioning, section-level analytics.

---

*Assumptions made in this draft: the product is **Bench**; **Change Connected is the first client/tenant and brands their instance "Change Hub"** (instance name and role labels are per-tenant config); single AWS account in `eu-west-2`; multi-tenant from the first migration (`tenant_id` + Postgres RLS), with self-serve onboarding/billing deferred; single admin per tenant; consultant and client are link-scoped, not account holders (until V2); the renderer reuses the existing Change Impact Profile layout and brand tokens; the auth pattern reuses belterpoc rather than being rebuilt; each tenant's instance reads as an extension of its own site (Change Connected's as an extension of `changeconnected.co.uk`). Flag any of these and I'll revise.*

---

## 17. V2 — Bench as a managed talent platform

### 17.0 What changes

V1 is a **shop window**: branded profiles, with consultants as link-scoped, account-less contributors. V2 turns it into a **managed talent hub** — supply (who's available, with what skills) meets demand (roles to fill) through search and AI-assisted matching. The profile becomes the public face of an operational backend.

> **Already pulled forward into V1 (ADR-0011).** The **two-axis model** (§17.3) and a **basic availability field** (§17.2) now ship in V1: a `status` lifecycle plus an owner-internal `availability` axis (available / looking + notice period / engaged + end date / pitched). What remains V2 is the *operational depth* around them — the freshness loop (last-confirmed, reconfirm nudges, staleness exclusion), CM self-service dashboards, the coming-available timeline, and search / AI matching. The references below to "V1 had a single status field" are superseded by ADR-0011.

Terminology is formalised in V2. These are **Change Connected's labels** for their Bench instance (per-tenant configurable — another tenant would set their own):

- **Change Maker (CM)** — the consultant. Now an account holder, not a link-scoped session.
- **Change Hub Admin (CHA)** — the admin/owner role.
- **Change Hub** — Change Connected's name for their Bench instance (the hub).
- **Opportunity** — a role to fill (the demand side).

Three architectural shifts underpin everything below, each a deliberate cost:

1. CMs move from link-scoped sessions to **Cognito accounts** (social auth).
2. The data store is **Aurora Postgres + pgvector** — adopted in V1 foundations precisely so V2 lands without migration.
3. **Bedrock** enters the stack for extraction, embeddings, and match rationale.

**Tenancy holds in V2.** CMs, availability, facets, Opportunities, and matches are all `tenant_id`-scoped. Search and AI matching run **strictly within a tenant** — a CHA only ever sees and matches their own Change Makers against their own Opportunities; embeddings and queries are filtered by `tenant_id` before they reach pgvector. No CM ever appears in another tenant's hub.

### 17.1 CM accounts & social auth

The magic link stops being the session and becomes the **claim** — it proves "you're the person the Change Hub invited," after which social auth binds a durable identity to the profile. Flow: invite link → claim → choose provider → account. Thereafter the CM logs in directly to their own dashboard.

- Cognito federation: **Google and Apple** native; **LinkedIn via generic OIDC** ("Sign in with LinkedIn using OpenID Connect" — not a built-in Cognito provider); **email OTP** as fallback so no one is forced to link a social account.
- **LinkedIn auth ≠ LinkedIn data.** OIDC returns name, email, photo — not work history. Experience comes from the wizard or CV extraction (§17.4), not from the login.

**Acceptance**
- Given a valid invite, when a CM claims it and authenticates with a provider, then that identity is bound to their profile and future logins go straight to their dashboard.
- One profile per identity; duplicate-email collisions are detected and resolved to a single account.
- Account recovery via email OTP.

### 17.2 Availability & the freshness loop

This is the feature that makes it a Hub rather than a directory, so it's the centre of gravity. The date alone is a trap — engagements slip and a stale date is a lie. The real feature is the **freshness loop**.

- Availability model: **status** (`available now` / `available from <date>` / `on engagement` / `not looking`), estimated **roll-off date**, **capacity** (full-time / part-time), and a **last-confirmed** timestamp.
- As the roll-off date approaches, the system nudges the CM to reconfirm. This is also the recurring reason a CM comes back to a persistent account.
- Availability is **internal to CHA by default** — it never appears on a client-shared profile unless CHA explicitly surfaces it.

**Acceptance**
- Given a CM on their dashboard, when they set or update availability, then `last-confirmed` is recorded.
- Given a roll-off date within the nudge window, when it approaches, then the CM receives a reconfirm prompt.
- Given availability older than the staleness threshold, when CHA filters for "available", then that CM is shown as **stale** and excluded until reconfirmed.

### 17.3 CHA pipeline (two axes)

V1 already splits this into **two independent axes** (ADR-0011); conflating them is how these tools turn to mush. V2 deepens each axis into a fuller pipeline:

- **Profile-state:** draft → invited → claimed → complete → published → in-review.
- **Availability-state:** available / coming available / on engagement / not looking.

Views:
- **Lanes board** by profile-state.
- **Coming-available timeline** — forward view of supply by roll-off date. This is the money view: it lines up upcoming supply against demand.
- **Funnel-leak surfacing** — invited-but-never-claimed, claimed-but-incomplete, stale-availability, and **new CMs with no profile yet**, each with a one-click nudge/resend.

**Acceptance**
- Given all CMs, when CHA opens the hub, then each CM shows both its profile-state and availability-state independently.
- Given a date window, when CHA opens the coming-available timeline, then CMs are listed by roll-off date within it.
- Given funnel leaks, when CHA views them, then each is listed explicitly with a remediation action.

### 17.4 Atomised skills & experience

Two layers, kept in sync:

- **Structured facets** for search — skills, sectors (financial services, aviation, infrastructure, automotive), methods (Agile / Lean / SAFe / Kanban), roles, seniority, org-scale ("led 5–40 teams"), regulated-environment exposure (DORA / NIS2), location, languages.
- **Narrative prose** for the pitch and as semantic context.

The facets are **extracted from the narrative (and optional CV upload) by the LLM at submit, then confirmed/edited by the CM**, normalised to a canonical taxonomy so "agile delivery" and "Agile" collapse to one tag. AI extracts and normalises — it does **not** write the bio.

**Acceptance**
- Given a submitted narrative or uploaded CV, when the CM reaches review, then the system proposes facets the CM can edit before saving.
- Given proposed facets, when saved, then synonyms are collapsed to canonical tags and both facets and narrative are stored.

### 17.5 Search & matching

Two modes, in order of trust:

1. **Deterministic facet filtering** — exact filters CHA can believe; **availability applied as a hard filter, not a preference**.
2. **Semantic match** — CHA selects or pastes an Opportunity brief; **Bedrock embeddings + pgvector** return a ranked shortlist **with reasons**; unavailable CMs excluded; the CM always makes the final call.

Explainable and assistive — never a black-box gatekeeper of people.

**Acceptance**
- Given facet filters, when CHA searches, then results are deterministic and exclude unavailable CMs by default.
- Given an Opportunity brief, when CHA runs a semantic match, then CMs are ranked with a short why-matched rationale, availability hard-filtered, and CHA can inspect or override.

### 17.6 Opportunities (demand)

- **Opportunity** entity: title, client / sector, facets needed, seniority, start date, duration, **status** (open → shortlisting → filled → closed).
- Matched against CM supply (§17.5); CHA assembles a shortlist per Opportunity and tracks outcome.

**Acceptance**
- Given structured needs, when CHA creates an Opportunity, then the system suggests matched CMs.
- Given matches, when CHA shortlists, then the Opportunity tracks through to fill.

### 17.7 Edit-with-review & versioning-lite

CMs own their accounts and can edit — but edits to a **published** profile create a working draft and drop the profile to **in-review**. The **last published snapshot stays live to client share links** until CHA approves the re-publish, so shared links never break or silently change mid-review.

**Acceptance**
- Given a published profile, when the CM edits it, then client links keep showing the last approved version and the profile shows in-review to CHA.
- Given an in-review profile, when CHA approves, then the live snapshot swaps to the new version.

### 17.8 AWS additions (on top of §12)

| Concern | Service |
|---|---|
| CM social auth | **Cognito** federation — Google, Apple (native), LinkedIn (OIDC), email OTP |
| Extraction, embeddings, match rationale | **Bedrock** — embeddings model + a matching/rationale LLM |
| Relational + vector store | **Aurora Serverless v2 Postgres + pgvector** (already in V1 foundations) |
| Availability nudges / freshness loop | **EventBridge Scheduler + SES** |
| CV upload & extraction pipeline | **S3 + Step Functions + Lambda** |

### 17.9 Data protection additions (UK GDPR)

- CM **account consent** and privacy notice at claim; record it.
- Availability data is **internal-only** unless explicitly surfaced.
- **AI-matching transparency** — CMs are told their data feeds matching, and match results are explainable.
- **Right to be excluded** from search (`not looking`) and **right to erasure** now extends to the Cognito account.
- Retention policy for **dormant CM accounts**.

### 17.10 Success metrics (V2)

- **Claim rate** — % of invited CMs who bind an account.
- **Availability freshness** — % of CMs confirmed within the window.
- **Time-to-shortlist** — Opportunity created → shortlist assembled.
- **Match acceptance** — % of shortlisted CMs who say yes.
- **Pipeline accuracy** — predicted vs actual roll-off dates.
- **Fill rate** — Opportunities filled via the hub.

### 17.11 Open questions (V2)

- **Bedrock model choice** *(eng)* — embeddings (Titan vs Cohere) and the rationale LLM (Claude on Bedrock for explainable match reasons?). *Non-blocking.*
- **Canonical skills taxonomy** *(owner/eng)* — build our own vs adopt an existing competency framework as the backbone. *Blocking for §17.4 — the taxonomy is the spine of search.*
- **Availability as commitment vs estimate** *(owner)* — how the UI frames roll-off dates to CHA so they're not treated as hard promises.
- **LinkedIn OIDC approval** *(eng)* — LinkedIn app review and scopes. *Blocking for LinkedIn auth.*
- **Multi-CHA seats** *(stakeholder)* — Cognito groups / multiple admins now, or still single?

### 17.12 Suggested V2 build order

1. CM accounts & claim flow (§17.1) + edit-with-review (§17.7) — the account foundation.
2. Availability & freshness loop (§17.2) + two-axis pipeline (§17.3) — the Hub.
3. Atomised facets & extraction (§17.4) — the data spine.
4. Opportunities (§17.6) + search & matching (§17.5) — supply × demand.

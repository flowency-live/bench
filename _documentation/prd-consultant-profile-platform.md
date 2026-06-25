# PRD — Consultant Profile Platform

**Working title:** Bench *(placeholder — "the bench" is the consultancy's roster of available consultants)*
**Author:** Jason Jones
**Status:** Draft v0.2
**Platform:** AWS, single account, `eu-west-2` (London) for UK data residency
**Last updated:** 25 June 2026

---

## 1. Problem statement

A consultancy presents its people to clients as profiles — who they are, what they're good at, and the impact they've delivered. Today that's a manual job: someone hand-builds a deck per consultant, chases the consultant for input over email, and the output drifts off-brand and out of date the moment it's saved. Sharing with a client is ad-hoc — a PDF attached to an email, no control over who it reaches, no idea whether it was opened.

The cost is owner time and credibility. Every profile is bespoke effort, every refresh is a re-do, and inconsistent profiles undermine the brand the consultancy is selling on.

This product turns the profile into structured data, lets the consultant fill it in themselves through a guided wizard, renders it on-brand automatically, and gives the owner controlled links to put specific profiles in front of specific clients.

## 2. Goals

1. **Cut owner time per profile from hours to minutes** — the owner adds a consultant and sends a link; the consultant does the input.
2. **Get profiles completed without chasing** — a consultant can finish a profile in one sitting, no account, no password, resumable.
3. **Every profile is on-brand by construction** — branding is applied at render from shared tokens, not re-created per profile.
4. **Owner controls client distribution** — share a specific profile with a specific client via a link that can expire and be revoked, with basic open tracking.
5. **One source of truth** — update once, every shared link reflects the change.

## 3. Non-goals (this version)

- **Multi-consultancy self-serve SaaS** — v1 is single-tenant (one consultancy, one brand). The data model is multi-tenant-ready but there's no public sign-up or billing.
- **Consultant marketplace / availability / rates** — not a staffing exchange. No booking, no day-rate logic.
- **Client accounts** — clients view via link only. No client login, dashboards, or shortlists in v1.
- **CRM / ATS integration** — no sync to Salesforce, Bullhorn, etc. Manual for now.
- **E-signature, contracting, or DOR­A/compliance attestations** on profiles — out of scope; this is a presentation tool, not a contracting one.
- **Rebuilding or migrating the marketing site** — `changeconnected.co.uk` stays where it is. This product lives alongside it on the brand domain and inherits its look; it does not replace it.

## 4. Roles & permissions

| Capability | Owner | Consultant (invite link) | Client (share link) |
|---|---|---|---|
| Log in to portal | ✅ | ❌ | ❌ |
| See all profiles | ✅ | ❌ | ❌ |
| Add / archive a consultant | ✅ | ❌ | ❌ |
| Edit any profile | ✅ | own only | ❌ |
| Complete profile via wizard | ✅ | own only | ❌ |
| Approve / publish a profile | ✅ | ❌ | ❌ |
| Generate invite link | ✅ | ❌ | ❌ |
| Generate / revoke client share link | ✅ | ❌ | ❌ |
| View a published profile | ✅ | own only | ✅ (scoped) |

Consultant and Client are **link-scoped sessions**, not user accounts — a magic link grants a short-lived session limited to one profile and one action.

## 5. Profile lifecycle

```
Draft ──invite sent──▶ Invited ──opens link──▶ In progress ──submits──▶ Submitted
                                                                            │
                                                          owner reviews ◀───┘
                                                                            │
                                              edits & approves ──▶ Published ──▶ Archived
```

- **Draft** — owner created the record (name + email), nothing else.
- **Invited** — an invite link exists and has been sent; not yet opened.
- **In progress** — consultant has opened the wizard; auto-saving.
- **Submitted** — consultant marked it complete; locked to consultant, open to owner.
- **Published** — owner approved; eligible for client share links.
- **Archived** — hidden from the active roster, links dead, data retained.

Client share links can only be created against a **Published** profile.

## 6. User stories

### Owner
- As the **owner**, I want to log in and see every consultant profile with its status, so I know at a glance what's done, in progress, or stalled.
- As the **owner**, I want to add a consultant with just their name and email, so I can get them started in seconds.
- As the **owner**, I want to send a consultant a link to complete their own profile, so I'm not transcribing their CV into a deck.
- As the **owner**, I want to review and edit a submitted profile before it goes out, so nothing off-brand or wrong reaches a client.
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
- As the **owner**, when a consultant hasn't started after N days, I want the roster to flag it, so I know to nudge.
- As a **client**, when a link has been revoked or expired, I want a neutral "this profile is no longer available" page, not an error.

## 7. Requirements

### P0 — Must have (v1 ships without these = it doesn't solve the problem)

**Owner authentication**
- Owner logs in via Amazon Cognito (Google federation and/or email). Sessions are signed and short-lived.
- Acceptance: Given a registered owner, when they authenticate, then they reach the roster; unauthenticated requests to portal routes redirect to login.

**Brand & website continuity**
- The entire product — portal, wizard, share view, and every error/landing page — uses the Change Connected brand system (logo, navy/lime/gradient tokens, Fredoka/Poppins, the site's heading style) and lives on the brand domain, so no one is ever handed off to something that looks like a third-party tool.
- Public-facing pages (share view, wizard) carry the site's header and footer treatment.
- Acceptance: Given any consultant or client opening a link, when the page loads, then it sits on a `changeconnected.co.uk` domain, shows the Change Connected logo and footer, and is visually indistinguishable from an extension of the main site.

**Roster dashboard**
- List of all profiles showing headshot, name, role, status, last updated; search by name; filter by status.
- Acceptance: Given profiles in mixed states, when the owner opens the dashboard, then each profile shows its current status and the list is searchable and filterable.

**Add consultant**
- Owner creates a profile with name + email (role optional). Creates a Draft.
- Acceptance: Given valid name and email, when the owner submits, then a Draft profile is created and appears in the roster; duplicate email warns but doesn't block.

**Invite magic link (owner → consultant)**
- Owner generates an invite link scoped to one profile; system can email it via the consultant's address; link is resumable until submit or expiry.
- Acceptance: Given a Draft, when the owner generates an invite, then a single-purpose tokenised URL is produced and the profile moves to Invited; opening it starts/resumes the wizard scoped to that profile only.

**Completion wizard (consultant)**
- Stepwise form mapping to the profile sections (see §9), with auto-save, inline guidance, photo upload, live preview, and submit.
- Acceptance: covered by §9 acceptance criteria.

**Profile renderer**
- Renders structured profile data through brand tokens into the branded one-pager, responsive on web, with print-to-PDF (A4 landscape and portrait).
- Acceptance: Given a complete profile, when rendered, then it matches the brand (navy/lime/gradient, logo, Fredoka/Poppins) and prints to a single A4 page in both orientations; all text meets WCAG 2.1 AA contrast.

**Owner review & publish**
- Owner can edit any field of a Submitted profile and publish it.
- Acceptance: Given a Submitted profile, when the owner edits and publishes, then status → Published and the profile becomes shareable.

**Client share link (owner → client)**
- Owner generates a share link against a Published profile, with an expiry and a revoke control; opening it shows the read-only profile.
- Acceptance: Given a Published profile, when the owner creates a share link with a 30-day expiry, then the client sees the profile until expiry or revoke; after either, the link shows a neutral unavailable page.

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

- **Multi-consultancy tenancy** with self-serve onboarding and billing.
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
- [ ] Submit locks the profile to the consultant and notifies the owner.
- [ ] An expired link shows a clear "request a new link" path, not an error.

## 10. Data model (entities)

- **Consultancy** — id, name, brand tokens (colours, logo asset, fonts), default profile template. *(Single row in v1; table exists for tenancy later.)*
- **User** — owner(s); id, email, auth provider.
- **Profile** — id, consultancy id, consultant name, email, role, status, headshot asset, positioning (headline, bio), timestamps.
- **Skill** — id, profile id, title, body, order.
- **Story** — id, profile id, client tag, title, body, order.
- **Testimonial** — id, profile id, quote, author name, author role, author company.
- **Asset** — id, profile id, type (headshot), original + processed renditions, dimensions.
- **MagicLink** — id, profile id, type (invite|share), token hash, scope, expiry, status, passcode hash (P1), created-by, created-at.
- **Event** — id, link id / profile id, kind (created|sent|opened|revoked|published), actor, timestamp.

## 11. Branding, rendering & website continuity

- The product is built to read as an **extension of `changeconnected.co.uk`**, not a separate app. Shared header and footer, the same logo (transparent-keyed), the same type and colour, the same heading style. A client following a share link should feel they never left the site.
- Profiles render from **brand tokens**, not per-profile styling: navy `#001930`, lime `#BAEB5B`, gradient `#73EB73 → #37ACED`, transparent-keyed logo, Fredoka (display) + Poppins (body). v1 hardcodes the Change Connected brand; P1 moves tokens to the Consultancy record.
- All three surfaces — portal, wizard, profile renderer — consume one **shared theme/component package** (reuse the existing Flowency/Change Connected design-system work: CSS tokens, Tailwind theme extension, React/TS components) so brand changes propagate everywhere from one place.
- One renderer, two paper layouts (A4 landscape and portrait), plus a responsive web view. Print path produces a single-page PDF per orientation.
- WCAG 2.1 AA contrast is a render-time guarantee, not a per-profile check — token pairs are validated once.

## 12. Technical architecture (AWS)

Everything runs in one AWS account in `eu-west-2` (London). Infrastructure as code in **AWS CDK (TypeScript)** to match the app stack. Service mapping:

| Concern | Service | Notes |
|---|---|---|
| App hosting (Next.js) | **Amplify Hosting** (or OpenNext on Lambda + CloudFront) | SSR for the portal, wizard, and public profile routes |
| CDN / TLS / DNS | **CloudFront + ACM + Route 53** | Brand domain; no-cache + no-index on link routes; cache static assets and rendered profiles |
| Owner auth | **Cognito** (Google federation + email) | Managed; hosted or custom UI |
| Link-scoped sessions | **Lambda + KMS-signed JWT**, validated by an **API Gateway Lambda authorizer** | Consultant/client are not Cognito users — they get scoped, short-lived signed sessions |
| API | **API Gateway (HTTP API) + Lambda** | Or the Next.js API layer; Lambda authorizer enforces scope |
| Data | **DynamoDB (single-table)** | Token lookup by hash via GSI; relational alternative is Aurora Serverless v2 (Postgres) — see open questions |
| Assets | **S3 + CloudFront**; **Lambda (Sharp)** for crop/grayscale/resize | Headshot originals + processed renditions |
| Email | **SES** (London region, domain + DKIM verified) | Invite and share emails |
| PDF | **Lambda + headless Chromium** (Puppeteer/Playwright) renders the profile route to a single-page A4 PDF | Server-side render guarantees Fredoka/Poppins load; output to S3, served via CloudFront |
| Secrets / signing | **Secrets Manager + KMS** | Token-signing keys never in code |
| Rate limiting / bot defence | **WAF + API Gateway throttling** | Protects public share and link-validation routes |
| Audit / events | **DynamoDB** event log, optional **EventBridge** fan-out | Backs the audit trail (§7) |
| Logs / metrics | **CloudWatch** | Dashboards for the success metrics in §14 |

This resolves the v0.1 open questions on email (SES), PDF generation (Lambda headless Chromium), and data residency (London region). It reuses the proven belterpoc auth pattern (magic-link + signed session cookies) rather than rebuilding it — implemented here on Lambda/KMS/DynamoDB.

## 13. Data protection (UK GDPR)

Profiles hold consultant PII (name, email, photo) and client view logs. Build in from v1:
- **Lawful basis & consent** — consultant agrees to their profile being shared with clients at submit; record the consent event.
- **Retention** — archived profiles and link logs retained for a defined period, then purged; document it.
- **Right to erasure** — owner can hard-delete a profile and its assets/logs on request.
- **Data residency** — entire stack pinned to `eu-west-2` (London): S3, DynamoDB, SES, Lambda. No data leaves the UK region (matters for regulated clients).
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

- **Data store** *(eng)* — DynamoDB single-table (lean, link-lookup-friendly) vs Aurora Serverless v2 Postgres (relational, natural for Profile→Skills/Stories). Leaning DynamoDB for v1. *Non-blocking — design the data layer behind a thin repository so it can swap.*
- **App hosting** *(eng)* — Amplify Hosting vs OpenNext on Lambda + CloudFront. Amplify is faster to stand up; OpenNext gives more control. *Non-blocking.*
- **Domain layout** *(owner/eng)* — subdomains (`portal.` / `profiles.changeconnected.co.uk`) vs paths on the apex. Public share links should sit on the brand domain either way. *Blocking for DNS/cert setup — pick before Route 53/ACM config.*
- **Marketing site source** *(eng)* — what is `changeconnected.co.uk` currently built on, and can its header/footer markup be reused directly, or do we rebuild the shell to match? Determines how literal "extension of the site" can be. *Blocking for the continuity requirement.*
- **Share default lifetime** *(owner)* — sensible default expiry, e.g. 30 days? *Non-blocking.*
- **Passcode in v1 or P1?** *(owner)* — leaked-link risk vs friction. Currently P1; confirm acceptable for first client shares. *Non-blocking.*
- **Multiple owners / seats** *(stakeholder)* — single owner in v1, or Cognito group with seats from the start? Assumed single. *Non-blocking.*

## 16. Phasing

- **Phase 0 (foundations):** AWS account hardening, CDK skeleton, Route 53 + ACM on the brand domain, shared brand/theme package, SES domain verification.
- **Phase 1 (v1, P0):** owner auth (Cognito), roster, add consultant, invite link, wizard, renderer (web + PDF via Lambda), review/publish, client share link with expiry + revoke, audit trail, full brand continuity. Single hardcoded brand.
- **Phase 2 (P1):** share open tracking on dashboard, passcodes, re-issue/resend, brand settings UI, templates, bulk invite.
- **Phase 3 (P2):** multi-tenancy + billing, client shortlists, CRM/ATS sync, versioning, section-level analytics.

---

*Assumptions made in this draft: single AWS account in `eu-west-2`; single consultancy and single brand for v1; single owner; consultant and client are link-scoped, not account holders; the renderer reuses the existing Change Impact Profile layout and brand tokens; the auth pattern reuses belterpoc rather than being rebuilt; the whole product is built to read as an extension of `changeconnected.co.uk`. Flag any of these and I'll revise.*

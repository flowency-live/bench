# Auth Journey Implementation Plan

## Goal
Get the complete authentication journey working end-to-end:
1. Godmode login with Google OAuth → list/manage tenants + users
2. Tenant owner login (magic-link + email/password) → view consultants
3. Data isolation proof: create second tenant, verify separation

---

## Phase 1: Close the Magic-Link Loop (Make Multi-Tenant Work)

**Status:** The godmode UI exists and works with fixtures, but new tenant admins cannot claim their onboarding links due to hardcoded `PILOT_TENANT_ID` checks.

### 1.1 Fix Auth Verify Route (Tenant Binding)

**File:** [apps/web/app/auth/verify/route.ts](apps/web/app/auth/verify/route.ts)

**Problem:** Line 70 rejects any link not from `PILOT_TENANT_ID`:
```typescript
if (lookup.tenantId !== PILOT_TENANT_ID) return invalid();
```

**Fix:**
- Remove the `PILOT_TENANT_ID` check
- Parse `email|tenantId` from `createdBy` field (godmode stashes this format)
- Activate pending user on claim via `UserRepository.setStatus()`

### 1.2 Fix Login Actions (Tenant Resolution)

**File:** [apps/web/app/login/actions.ts](apps/web/app/login/actions.ts)

**Problem:** Line 50 hardcodes tenant:
```typescript
await links.create(PILOT_TENANT_ID, {...})
```

**Fix:**
- Use `UserRepository.getByEmail()` to find which tenant the admin belongs to
- Create link scoped to their actual tenant

### 1.3 Add `getTenantId()` Helper

**File:** [apps/web/lib/auth/session.ts](apps/web/lib/auth/session.ts)

Add helper to resolve tenant from any session type:
```typescript
export async function getTenantId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  switch (session.kind) {
    case 'platform': return session.activeTenantId ?? null;
    case 'admin': return session.tenantId;
    case 'member': return session.tenantId;
  }
}
```

### 1.4 De-hardcode PILOT_TENANT_ID Usage

**Files to update (use `getTenantId()` instead):**
- [apps/web/app/dashboard/page.tsx](apps/web/app/dashboard/page.tsx)
- [apps/web/app/actions.ts](apps/web/app/actions.ts) (7 usages)
- [apps/web/app/profiles/[id]/page.tsx](apps/web/app/profiles/[id]/page.tsx)
- [apps/web/app/profiles/[id]/edit/page.tsx](apps/web/app/profiles/[id]/edit/page.tsx)
- [apps/web/app/profiles/[id]/print/page.tsx](apps/web/app/profiles/[id]/print/page.tsx)
- [apps/web/app/profiles/[id]/invite-actions.ts](apps/web/app/profiles/[id]/invite-actions.ts)
- [apps/web/app/api/upload/route.ts](apps/web/app/api/upload/route.ts)

**Acceptance Criteria:**
- [ ] New tenant admin can claim their onboarding link
- [ ] Session is created with correct tenantId (not PILOT)
- [ ] Dashboard loads profiles scoped to session tenant
- [ ] Profile CRUD operations scope to session tenant

---

## Phase 2: Google OAuth for Godmode

**Goal:** Platform admins (`@flowency.co.uk`) login via Google instead of magic-link.

### 2.0 Flowency Branding for Godmode

Godmode is the **Flowency** control plane, not tenant-branded. Apply Flowency brand (from screenshot):

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f0f1a` (very dark navy) | Page bg |
| Panel | `#1a1a2e` | Cards, raised surfaces |
| Accent | `#f97316` (warm orange) | Logo, CTAs, highlights |
| Text primary | `#ffffff` | Headings, body |
| Text muted | `#6b7280` | Secondary text ("THAT FLOW" style) |
| Border | `rgba(249,115,22,0.3)` | Subtle orange borders |
| Logo | Flowency arrow + wordmark | Header |

**Files to update:**
- `apps/web/app/godmode/layout.tsx` (create) - Flowency CSS vars, isolated from tenant theme
- `apps/web/app/godmode/page.tsx` - Use Flowency logo
- `apps/web/app/godmode/login/page.tsx` - Flowency branded login
- `apps/web/components/FlowencyLogo.tsx` (create) - Flowency logo SVG component

**Note:** The Flowency logo SVG will need to be created or sourced from the live site.

### 2.1 Cognito Google Identity Provider

**File:** [infrastructure/lib/stacks/bench-auth-stack.ts](infrastructure/lib/stacks/bench-auth-stack.ts)

Add Google as federated identity provider:
- Configure OAuth consent in Google Cloud Console
- Add `UserPoolIdentityProviderGoogle` to Cognito
- Set callback URL: `https://bench.opstack.uk/godmode/auth/callback`

### 2.2 OAuth State Table

Use existing DynamoDB table with TTL for CSRF state tokens:
- Key: `OAUTH#state#{stateToken}`
- Attributes: `origin`, `ttl` (5 min)

### 2.3 Godmode Auth Routes

**New files:**
- `apps/web/app/godmode/auth/google/route.ts` - Initiate OAuth flow
- `apps/web/app/godmode/auth/callback/route.ts` - Handle callback, validate email domain, create session

**Reference:** [bndy-serverless-api/auth-lambda/handler.js](c:\VSProjects\bndy-serverless-api\auth-lambda\handler.js) lines 194-365

### 2.4 Update Godmode Login UI

**File:** [apps/web/app/godmode/login/page.tsx](apps/web/app/godmode/login/page.tsx)

Add "Sign in with Google" button (keep magic-link as fallback).

**Acceptance Criteria:**
- [ ] Google OAuth button on godmode login
- [ ] OAuth flow creates platform session
- [ ] Non-@flowency.co.uk emails rejected
- [ ] Magic-link fallback still works

---

## Phase 3: Tenant Owner Email/Password Auth

**Goal:** Tenant owners can login via magic-link OR email/password with verification.

### 3.1 Cognito Email/Password Setup

**File:** [infrastructure/lib/stacks/bench-auth-stack.ts](infrastructure/lib/stacks/bench-auth-stack.ts)

Configure Cognito for email/password:
- Enable email as sign-in alias (already done)
- Enable self-service password reset
- Configure email verification via SES

### 3.2 Registration Flow

**New files:**
- `apps/web/app/register/page.tsx` - Registration form (email, password, confirm)
- `apps/web/app/register/actions.ts` - Create Cognito user, send verification

Flow:
1. Tenant admin invited via godmode → receives onboarding link
2. Claims link → presented with "Set your password" form
3. Creates Cognito account with email + password
4. Verification email sent via SES
5. After verification → admin session created

### 3.3 Login with Password

**Files:**
- [apps/web/app/login/page.tsx](apps/web/app/login/page.tsx) - Add password field + "Forgot password" link
- `apps/web/app/login/password-actions.ts` - Cognito authentication

### 3.4 Password Reset

**New files:**
- `apps/web/app/forgot-password/page.tsx`
- `apps/web/app/reset-password/page.tsx`

**Acceptance Criteria:**
- [ ] New tenant admin can set password on first claim
- [ ] Existing admin can login with email/password
- [ ] Password reset flow works via email
- [ ] Magic-link still works as alternative

---

## Phase 4: SES Email Integration

**Goal:** Send magic links via email in production.

**Files:**
- [apps/web/app/login/actions.ts](apps/web/app/login/actions.ts) - `// TODO(SES)` at line 64
- [apps/web/app/godmode/login/actions.ts](apps/web/app/godmode/login/actions.ts)
- [apps/web/app/godmode/actions.ts](apps/web/app/godmode/actions.ts) - tenant admin onboarding link

**Implementation:**
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
// Send branded email with magic link
```

**Prerequisites:** SES domain verification + DKIM for `bench.opstack.uk`

---

## Phase 5: Data Isolation Proof

**Goal:** Demonstrate tenant isolation works.

**Test Scenario:**
1. Platform admin (you) logs in to godmode
2. Create "Acme Corp" tenant with `admin@acme.com`
3. Acme admin claims link → sees empty dashboard
4. Acme admin creates a consultant profile
5. Switch back to Change Connected → Acme profile NOT visible
6. Query DynamoDB: verify `TENANT#acme-corp` prefix on Acme data

---

## Data Layer Note

**Decision:** Use in-memory fixtures for now. Implement DynamoDB repositories later once the auth journey is proven.

The fixtures persist on `globalThis` during dev server lifetime, which is sufficient for local testing and proving the flow.

---

## Sequencing

```
Phase 1 (Magic-Link Loop) ──────────────────────────────┐
├─ 1.1 Fix auth/verify tenant binding                   │
├─ 1.2 Fix login/actions tenant resolution              │ GATES ALL ELSE
├─ 1.3 Add getTenantId() helper                         │
└─ 1.4 De-hardcode 15+ files                            │
                                                        ▼
Phase 2 (Google OAuth Godmode) ─────────────────────────┐
├─ 2.1 Cognito Google IdP                               │
├─ 2.2 OAuth state storage                              │
├─ 2.3 Auth routes                                      │
└─ 2.4 Login UI                                         │
                                                        ▼
Phase 3 (Email/Password for Owners) ────────────────────┤
├─ 3.1 Cognito email/password config                    │ CAN PARALLEL
├─ 3.2 Registration flow (set password on claim)        │ WITH PHASE 4
├─ 3.3 Login with password                              │
└─ 3.4 Password reset                                   │
                                                        ▼
Phase 4 (SES Email) ────────────────────────────────────┤
└─ Wire email sending for production                    │
                                                        ▼
Phase 5 (Isolation Proof) ──────────────────────────────┘
└─ Create second tenant, verify separation
```

---

## Critical Files Summary

| Purpose | File |
|---------|------|
| Session helper | [apps/web/lib/auth/session.ts](apps/web/lib/auth/session.ts) |
| Auth verify | [apps/web/app/auth/verify/route.ts](apps/web/app/auth/verify/route.ts) |
| Login actions | [apps/web/app/login/actions.ts](apps/web/app/login/actions.ts) |
| Godmode page | [apps/web/app/godmode/page.tsx](apps/web/app/godmode/page.tsx) |
| Godmode actions | [apps/web/app/godmode/actions.ts](apps/web/app/godmode/actions.ts) |
| Dashboard | [apps/web/app/dashboard/page.tsx](apps/web/app/dashboard/page.tsx) |
| Cognito stack | [infrastructure/lib/stacks/bench-auth-stack.ts](infrastructure/lib/stacks/bench-auth-stack.ts) |

---

## Verification

After each phase:

**Phase 1:**
```bash
pnpm dev
```
1. Login as existing admin (Change Connected) → dashboard shows existing profiles
2. Go to `/godmode` → list tenants, see Change Connected
3. Create "Acme Corp" tenant with your email
4. Claim the onboarding link shown in dev mode
5. Land on empty dashboard scoped to Acme Corp
6. Switch back to Change Connected in godmode → see original profiles

**Phase 2:**
1. Go to `/godmode/login`
2. Click "Sign in with Google"
3. Authenticate with `@flowency.co.uk` account
4. Land on godmode dashboard

**Phase 3:**
1. As existing tenant admin, go to `/login`
2. Enter email + password → lands on dashboard
3. Test "Forgot password" flow
4. New tenant admin claims link → sets password → lands on dashboard

**Phase 4:**
1. Check SES verified domain
2. Request magic link in production mode → email arrives
3. Click link → session created

**Phase 5:**
1. Two tenants exist (Change Connected + Acme Corp)
2. Each has different profiles
3. No cross-tenant visibility in UI
4. Query DynamoDB: `TENANT#change-connected` vs `TENANT#acme-corp` items separate

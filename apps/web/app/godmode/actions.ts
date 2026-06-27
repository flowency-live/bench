'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTenantRepository } from '@/lib/data/tenant';
import { getUserRepository } from '@/lib/data/user';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getPlatformSession } from '@/lib/auth/platform';
import { createSession } from '@/lib/auth/session';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Tenant-admin onboarding links are short-lived — 30 minutes. */
const ADMIN_LINK_TTL_MS = 30 * 60 * 1000;

/** Sentinel profile slot under which tenant-admin (owner) magic links are stored. */
const ADMIN_PROFILE_ID = 'ADMIN';

/** State returned to the create-tenant form. */
export interface CreateTenantState {
  readonly ok: boolean;
  readonly error?: string;
  /** The created tenant's name (for the confirmation copy). */
  readonly tenantName?: string;
  /** Dev-only: the admin onboarding link, surfaced only outside production. */
  readonly devAdminLink?: string;
}

/**
 * Create a tenant + its first admin, and mint that admin an onboarding link.
 * Godmode-only — requires a platform session (ADR-0010 §Flows(1)).
 *
 * Steps:
 *  1. Create the Tenant (status 'active').
 *  2. Create the admin TenantUser (role 'admin', status 'pending', invitedBy
 *     the platform admin's email).
 *  3. Mint a tenant-admin magic link the admin claims to get their session.
 */
export async function createTenant(
  _prev: CreateTenantState,
  formData: FormData,
): Promise<CreateTenantState> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorised.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const instanceName = String(formData.get('instanceName') ?? '').trim();
  const adminEmail = String(formData.get('adminEmail') ?? '')
    .trim()
    .toLowerCase();

  if (!name) {
    return { ok: false, error: 'Company name is required.' };
  }
  if (!EMAIL_RE.test(adminEmail)) {
    return { ok: false, error: 'A valid first-admin email is required.' };
  }

  // 1. Create the tenant.
  const tenants = getTenantRepository();
  const tenant = await tenants.create({
    name,
    instanceName: instanceName || undefined,
  });

  // 2. Create the first admin user (pending until they claim the link).
  const users = getUserRepository();
  await users.create(tenant.id, {
    email: adminEmail,
    role: 'admin',
    invitedBy: platform.email,
  });

  // 3. Mint the tenant-admin onboarding link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // TODO(magic-link binding): the magic-link `create` signature is tenant-scoped
  // and the verify route's ADMIN branch currently asserts `tenantId ===
  // PILOT_TENANT_ID` and reads the admin email back from `createdBy`. To bind
  // this admin to the NEW tenant on claim, we stash `email|tenantId` in
  // `createdBy`; the verify ADMIN branch (and/or @bench/data) must be extended
  // to parse it and seed an admin session for the new tenant. Until that lands,
  // claiming this link against the current ADMIN branch would resolve the wrong
  // tenant — this is the known follow-up noted in the report.
  const links = getMagicLinkRepository();
  await links.create(tenant.id, {
    id: randomUUID(),
    profileId: ADMIN_PROFILE_ID,
    type: 'invite',
    scope: 'edit',
    tokenHash,
    expiresAt: new Date(Date.now() + ADMIN_LINK_TTL_MS).toISOString(),
    // Stash both the admin email and the target tenant so the claim can bind the
    // admin to THIS tenant (see TODO above).
    createdBy: `${adminEmail}|${tenant.id}`,
  });

  const verifyPath = `/auth/verify?token=${rawToken}`;

  // Refresh the tenant list shown on the godmode dashboard.
  revalidatePath('/godmode');

  // TODO(SES): email this onboarding link to the admin in production.
  if (process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      tenantName: tenant.name,
      devAdminLink: verifyPath,
    };
  }

  return { ok: true, tenantName: tenant.name };
}

/**
 * Switch the platform admin into a tenant (impersonate) — ADR-0010 §Decisions(2).
 *
 * Re-mints the platform session with `activeTenantId` set, then redirects to the
 * tenant dashboard. Godmode-only.
 */
export async function switchTenant(formData: FormData): Promise<void> {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  if (!tenantId) {
    redirect('/godmode');
  }

  // Confirm the tenant exists before switching in.
  const tenant = await getTenantRepository().get(tenantId);
  if (!tenant) {
    redirect('/godmode');
  }

  // Re-mint the platform session with the active tenant set (impersonation).
  // NOTE: createSession recomputes `exp` to a full TTL window — acceptable here,
  // since switching in is an explicit platform-admin action.
  await createSession({
    kind: 'platform',
    email: platform.email,
    activeTenantId: tenant.id,
  });

  redirect('/dashboard');
}

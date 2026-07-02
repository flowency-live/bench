'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getTenantRepository, type TenantStatus } from '@/lib/data/tenant';
import { getUserRepository, type TenantUserRole } from '@/lib/data/user';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getPlatformSession } from '@/lib/auth/platform';
import { createSession } from '@/lib/auth/session';
import { PILOT_TENANT_ID } from '@/lib/tenant';
import { sendOnboardingEmail } from '@/lib/email/send';

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

  // Get the origin to construct the full URL for the email.
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const verifyUrl = `${protocol}://${host}${verifyPath}`;

  // Send the onboarding email (skipped in non-production, logs instead).
  await sendOnboardingEmail({
    to: adminEmail,
    tenantName: tenant.instanceName ?? tenant.name,
    verifyUrl,
    invitedBy: platform.email,
  });

  // Refresh the tenant list shown on the godmode dashboard.
  revalidatePath('/godmode');

  // In dev, also surface the link directly for testing.
  if (process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      tenantName: tenant.name,
      devAdminLink: verifyPath,
    };
  }

  return { ok: true, tenantName: tenant.name };
}

/** State returned to the godmode admin-invite control. */
export interface ResendInviteState {
  readonly ok: boolean;
  readonly error?: string;
  /** Relative `/auth/verify?token=…` path — composed to an absolute URL + shared. */
  readonly link?: string;
}

/**
 * Re-issue a tenant admin's onboarding / sign-in link (ISS-1).
 *
 * Godmode mints the first admin link at tenant-create; this lets the platform
 * admin generate a FRESH single-use link for an existing admin at any time —
 * for a pending admin (re-send onboarding) or an active one (sign-in recovery,
 * e.g. a new device). Mirrors `createTenant` step 3 exactly so the link flows
 * through the same `/auth/verify` path.
 *
 * Generate-and-share (Jason's requirement): the link is **returned** so godmode
 * can Copy / WhatsApp / Email / SMS it, not only auto-emailed. We also send the
 * onboarding email best-effort (no-op in non-production).
 *
 * Admin-only: we refuse to issue this admin-scoped link to a viewer (the verify
 * ADMIN branch grants an admin session, so issuing it to a viewer would escalate
 * privilege). Platform-session required.
 */
export async function resendAdminInvite(
  tenantId: string,
  userId: string,
): Promise<ResendInviteState> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorised.' };
  }
  if (!tenantId || !userId) {
    console.error('[resendAdminInvite] Missing params:', { tenantId, userId });
    return { ok: false, error: `Tenant and user are required. (received: tenantId=${tenantId}, userId=${userId})` };
  }

  // Resolve the user server-side (authoritative email + role — never trust the client).
  const users = getUserRepository();
  const user = (await users.listByTenant(tenantId)).find((u) => u.id === userId);
  if (!user) {
    return { ok: false, error: 'User not found.' };
  }
  if (user.role !== 'admin') {
    return { ok: false, error: 'Invite links can only be issued to tenant admins.' };
  }

  const tenant = await getTenantRepository().get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found.' };
  }

  // Mint a fresh single-use admin link (same shape as createTenant step 3).
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const links = getMagicLinkRepository();
  await links.create(tenantId, {
    id: randomUUID(),
    profileId: ADMIN_PROFILE_ID,
    type: 'invite',
    scope: 'edit',
    tokenHash,
    expiresAt: new Date(Date.now() + ADMIN_LINK_TTL_MS).toISOString(),
    // Bind this admin's email to THIS tenant so the claim resolves correctly.
    createdBy: `${user.email}|${tenantId}`,
  });

  const verifyPath = `/auth/verify?token=${rawToken}`;

  // Best-effort email to the bound admin's inbox (never the requester's).
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  await sendOnboardingEmail({
    to: user.email,
    tenantName: tenant.instanceName ?? tenant.name,
    verifyUrl: `${protocol}://${host}${verifyPath}`,
    invitedBy: platform.email,
  });

  // TODO(audit): record { actor: platform.email, action, tenantId, target, at }
  console.info('[godmode-audit]', {
    actor: platform.email,
    action: 'tenant-admin.reinvite',
    tenantId,
    target: user.email,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true, link: verifyPath };
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

/** State returned to the godmode tenant-management controls. */
export interface TenantActionState {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Suspend or reactivate a tenant — ADR-0010 §control-plane.
 * Godmode-only; a suspended tenant's users cannot sign in (enforced elsewhere).
 */
export async function setTenantStatus(
  formData: FormData,
): Promise<TenantActionState> {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!tenantId) {
    return { ok: false, error: 'Tenant is required.' };
  }
  if (status !== 'active' && status !== 'suspended') {
    return { ok: false, error: 'Invalid status.' };
  }

  const tenants = getTenantRepository();
  await tenants.setStatus(tenantId, status as TenantStatus);

  // TODO(audit): record { actor: platform.email, action, tenantId, target, at }
  console.info('[godmode-audit]', {
    actor: platform.email,
    action: status === 'suspended' ? 'tenant.suspend' : 'tenant.reactivate',
    tenantId,
    target: tenantId,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true };
}

/**
 * Hard-delete a tenant and cascade-remove its users — ADR-0010 §control-plane.
 *
 * Guardrails (godmode-only):
 *  - requires `confirmName` to exactly match the tenant's name (type-to-confirm),
 *  - refuses to delete the pilot `change-connected` tenant unless `force` is set
 *    (guards against fat-fingering the live tenant).
 */
export async function deleteTenant(
  formData: FormData,
): Promise<TenantActionState> {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const confirmName = String(formData.get('confirmName') ?? '');
  const force = String(formData.get('force') ?? '').trim() !== '';
  if (!tenantId) {
    return { ok: false, error: 'Tenant is required.' };
  }

  const tenants = getTenantRepository();
  const tenant = await tenants.get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found.' };
  }

  if (confirmName.trim() !== tenant.name) {
    return { ok: false, error: 'Name did not match.' };
  }

  if (tenant.id === PILOT_TENANT_ID && !force) {
    return {
      ok: false,
      error:
        'Refusing to delete the pilot change-connected tenant. This is the live ' +
        'tenant — set the force flag to override.',
    };
  }

  const users = getUserRepository();
  await users.removeByTenant(tenantId);
  // TODO(@bench/data): also purge the tenant's profiles + magic links.
  await tenants.delete(tenantId);

  // TODO(audit): record { actor: platform.email, action, tenantId, target, at }
  console.info('[godmode-audit]', {
    actor: platform.email,
    action: 'tenant.delete',
    tenantId,
    target: tenant.name,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true };
}

/**
 * Remove a single user from a tenant — ADR-0010 §control-plane.
 * Surfaces the repository's last-active-admin guard as a form error rather than
 * throwing, so the operator sees why the removal was refused.
 */
export async function removeTenantUser(
  formData: FormData,
): Promise<TenantActionState> {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const userId = String(formData.get('userId') ?? '').trim();
  if (!tenantId || !userId) {
    return { ok: false, error: 'Tenant and user are required.' };
  }

  const users = getUserRepository();
  try {
    await users.remove(tenantId, userId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not remove user.',
    };
  }

  // TODO(audit): record { actor: platform.email, action, tenantId, target, at }
  console.info('[godmode-audit]', {
    actor: platform.email,
    action: 'tenant-user.remove',
    tenantId,
    target: userId,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true };
}

/**
 * Add a new admin user to an existing tenant — ADR-0010 §control-plane.
 * Godmode-only.
 */
export async function addTenantAdmin(
  tenantId: string,
  email: string,
): Promise<TenantActionState & { userId?: string }> {
  const platform = await getPlatformSession();
  if (!platform) {
    return { ok: false, error: 'Not authorised.' };
  }
  if (!tenantId || !email) {
    return { ok: false, error: 'Tenant and email are required.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Invalid email address.' };
  }

  const tenant = await getTenantRepository().get(tenantId);
  if (!tenant) {
    return { ok: false, error: 'Tenant not found.' };
  }

  const users = getUserRepository();
  const user = await users.create(tenantId, {
    email: email.toLowerCase(),
    role: 'admin',
    invitedBy: platform.email,
  });

  console.info('[godmode-audit]', {
    actor: platform.email,
    action: 'tenant-admin.add',
    tenantId,
    target: email,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true, userId: user.id };
}

/**
 * Change a tenant user's role (admin/viewer) — ADR-0010 §control-plane.
 * Godmode-only.
 */
export async function setTenantUserRole(
  formData: FormData,
): Promise<TenantActionState> {
  const platform = await getPlatformSession();
  if (!platform) {
    redirect('/godmode/login');
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const userId = String(formData.get('userId') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();
  if (!tenantId || !userId) {
    return { ok: false, error: 'Tenant and user are required.' };
  }
  if (role !== 'admin' && role !== 'viewer') {
    return { ok: false, error: 'Invalid role.' };
  }

  const users = getUserRepository();
  try {
    await users.setRole(tenantId, userId, role as TenantUserRole);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not change role.',
    };
  }

  // TODO(audit): record { actor: platform.email, action, tenantId, target, at }
  console.info('[godmode-audit]', {
    actor: platform.email,
    action: 'tenant-user.set-role',
    tenantId,
    target: `${userId}:${role}`,
    at: new Date().toISOString(),
  });

  revalidatePath('/godmode');
  return { ok: true };
}

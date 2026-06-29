'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRepository } from '@/lib/data/repository';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getTenantRepository } from '@/lib/data/tenant';
import { getSession, getTenantId } from '@/lib/auth/session';
import type { Availability, FormState, ProfilePatch, ProfileStatus } from '@/lib/types';

/** Convert a string to a URL-safe slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Get the current tenant ID from session, or throw if not authenticated. */
async function requireTenantId(): Promise<string> {
  const session = await getSession();
  const tenantId = getTenantId(session);
  if (!tenantId) {
    throw new Error('Not authenticated');
  }
  return tenantId;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Add a consultant (creates a Draft) then opens their profile. */
export async function createConsultant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

  if (name.length < 2) return { error: 'Please enter the consultant full name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };

  const tenantId = await requireTenantId();
  const repo = getRepository();
  const profile = await repo.create(tenantId, {
    name,
    email,
    role: role || undefined,
  });

  revalidatePath('/dashboard');
  redirect(`/profiles/${profile.id}`);
}

/** Change a profile's lifecycle status (publish / archive / etc.). */
export async function changeStatus(formData: FormData): Promise<void> {
  const profileId = String(formData.get('profileId') ?? '');
  const status = String(formData.get('status') ?? '') as ProfileStatus;
  if (!profileId || !status) return;

  const tenantId = await requireTenantId();
  const repo = getRepository();
  await repo.setStatus(tenantId, profileId, status);

  revalidatePath('/dashboard');
  revalidatePath(`/profiles/${profileId}`);
}

/** Save wizard edits to a profile. Called from the client wizard. */
export async function saveProfile(profileId: string, patch: ProfilePatch) {
  const tenantId = await requireTenantId();
  const repo = getRepository();
  const updated = await repo.update(tenantId, profileId, patch);
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');
  return updated;
}

/** Consultant submits their completed profile for owner review. */
export async function submitForReview(profileId: string) {
  const tenantId = await requireTenantId();
  const repo = getRepository();
  await repo.setStatus(tenantId, profileId, 'in_progress');
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');
}

/** Update a profile's availability (market position). */
export async function setAvailability(profileId: string, availability: Availability) {
  const tenantId = await requireTenantId();
  const repo = getRepository();
  await repo.update(tenantId, profileId, { availability });
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');
}

/** Share link expiry — 30 days from creation. */
const SHARE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Mint a no-auth, view-only share link for a published profile.
 *
 * The raw token is generated here and returned to the owner exactly once; we
 * persist ONLY its SHA-256 hash (the table never sees the secret). On open,
 * the share route re-hashes the URL token and resolves it via GSI3
 * (`lookupByTokenHash`) to recover tenant context — the one cross-tenant read
 * per ADR-0008.
 *
 * Returns a readable URL path: `/share/{tenantSlug}/{consultantSlug}/{token}`
 * The slugs are cosmetic (human-readable); the token is the secret that gates access.
 */
export async function createShareLink(profileId: string): Promise<string> {
  const tenantId = await requireTenantId();

  // Get tenant and profile for the readable URL slugs
  const tenant = await getTenantRepository().get(tenantId);
  const profile = await getRepository().get(tenantId, profileId);

  if (!tenant || !profile) {
    throw new Error('Tenant or profile not found');
  }

  // 32 bytes of entropy, URL-safe — the secret half of the share link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const links = getMagicLinkRepository();
  await links.create(tenantId, {
    id: randomUUID(),
    profileId,
    type: 'share',
    scope: 'view',
    tokenHash,
    expiresAt: new Date(Date.now() + SHARE_LINK_TTL_MS).toISOString(),
    createdBy: 'owner',
  });

  // Build readable URL: /share/{tenantSlug}/{consultantSlug}/{token}
  const tenantSlug = tenant.slug;
  const consultantSlug = slugify(profile.name);

  return `/share/${tenantSlug}/${consultantSlug}/${rawToken}`;
}

/**
 * Get the active share link for a profile, if one exists.
 *
 * NOTE: We store only the token hash, not the raw token. So we cannot
 * reconstruct the shareable URL for existing links. This returns metadata
 * about the link (id, createdAt) but not the URL itself. Users must create
 * a new link to get a shareable URL.
 */
export async function getActiveShareLink(
  profileId: string,
): Promise<{ id: string; createdAt: string } | null> {
  const tenantId = await requireTenantId();
  const links = getMagicLinkRepository();
  const shareLinks = await links.listSharesByProfile(tenantId, profileId);

  // Find an active, non-expired link
  const now = Date.now();
  const activeLink = shareLinks.find(
    (link) => link.status === 'active' && new Date(link.expiresAt).getTime() > now,
  );

  if (!activeLink) return null;

  return {
    id: activeLink.id,
    createdAt: activeLink.createdAt,
  };
}

/**
 * Revoke (deactivate) a share link.
 */
export async function revokeShareLink(profileId: string, linkId: string): Promise<void> {
  const tenantId = await requireTenantId();
  const links = getMagicLinkRepository();
  await links.markAsRevoked(tenantId, profileId, linkId);
  revalidatePath(`/profiles/${profileId}`);
}

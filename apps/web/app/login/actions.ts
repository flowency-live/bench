'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { getTenantRepository } from '@/lib/data/tenant';
import { sendMagicLinkEmail } from '@/lib/email/send';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Admin sign-in links are short-lived — 30 minutes. */
const ADMIN_LINK_TTL_MS = 30 * 60 * 1000;

/**
 * Special profile slot used for admin (owner) magic links. Owner sign-in is not
 * tied to a consultant profile, so all admin links live under this sentinel
 * profileId; the verify route asserts `profileId === 'ADMIN'`.
 */
const ADMIN_PROFILE_ID = 'ADMIN';

/** State returned to the login form. */
export interface AdminLinkState {
  readonly ok: boolean;
  /** Dev-only: a clickable verify link, present only outside production. */
  readonly devLink?: string;
}

/**
 * Request an admin sign-in link.
 *
 * SECURITY: the response is identical whether or not the email is a registered
 * tenant admin — we never reveal which emails exist. A link is only minted (and
 * a `devLink` surfaced) when the email belongs to an active admin TenantUser.
 *
 * Multi-tenant: resolves the user's tenant via UserRepository.getByEmail (GSI1
 * EMAIL# lookup) and scopes the link to that tenant (ADR-0010 Phase 1).
 */
export async function requestAdminLink(
  _prev: AdminLinkState,
  formData: FormData,
): Promise<AdminLinkState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  // Invalid input → neutral success, no link minted.
  if (!EMAIL_RE.test(email)) {
    return { ok: true };
  }

  // Look up the user by email to get their tenant context.
  const users = getUserRepository();
  const user = await users.getByEmail(email);

  // No user found or not an admin → neutral success, no link minted.
  if (!user || user.role !== 'admin') {
    return { ok: true };
  }

  // 32 bytes of entropy, URL-safe — the secret half of the sign-in link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // Create link scoped to the user's tenant (multi-tenant).
  const links = getMagicLinkRepository();
  await links.create(user.tenantId, {
    id: randomUUID(),
    profileId: ADMIN_PROFILE_ID,
    type: 'invite',
    scope: 'edit',
    tokenHash,
    expiresAt: new Date(Date.now() + ADMIN_LINK_TTL_MS).toISOString(),
    // The verify route reads `createdBy` back as the admin's email to seed the
    // session, so the link is self-describing (no separate email store needed).
    createdBy: email,
  });

  const verifyPath = `/auth/verify?token=${rawToken}`;

  // Get the origin to construct the full URL for the email.
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const verifyUrl = `${protocol}://${host}${verifyPath}`;

  // Get tenant name for the email.
  const tenant = await getTenantRepository().get(user.tenantId);
  const tenantName = tenant?.instanceName ?? tenant?.name ?? 'Bench';

  // Send the magic link email (skipped in non-production, logs instead).
  await sendMagicLinkEmail({
    to: email,
    subject: `Sign in to ${tenantName}`,
    verifyUrl,
    tenantName,
  });

  // In dev, also surface the link directly for testing.
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true, devLink: verifyPath };
  }

  return { ok: true };
}

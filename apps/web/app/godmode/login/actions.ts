'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { isPlatformAdmin } from '@/lib/auth/platform';
import { PILOT_TENANT_ID } from '@/lib/tenant';
import { sendMagicLinkEmail } from '@/lib/email/send';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Platform sign-in links are short-lived — 30 minutes. */
const PLATFORM_LINK_TTL_MS = 30 * 60 * 1000;

/**
 * Sentinel profile slot for platform (godmode) magic links. Godmode sign-in is
 * not tied to a tenant or consultant profile, so all platform links live under
 * this sentinel profileId; the verify route asserts `profileId === 'PLATFORM'`.
 */
const PLATFORM_PROFILE_ID = 'PLATFORM';

/** State returned to the godmode login form. */
export interface PlatformLinkState {
  readonly ok: boolean;
  /** Dev-only: a clickable verify link, present only outside production. */
  readonly devLink?: string;
}

/**
 * Request a godmode (platform super-admin) sign-in link — ADR-0010 §Decisions(2).
 *
 * Until Google OAuth lands, godmode bootstraps via a magic link to an allowlisted
 * Flowency address. SECURITY: the response is identical whether or not the email
 * is a platform admin — we never reveal which emails are allowlisted. A link is
 * only minted (and a `devLink` surfaced) when the email is a platform admin AND
 * we're not in production.
 */
export async function requestPlatformLink(
  _prev: PlatformLinkState,
  formData: FormData,
): Promise<PlatformLinkState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  // Invalid input or not a platform admin → neutral success, no link minted.
  if (!EMAIL_RE.test(email) || !isPlatformAdmin(email)) {
    return { ok: true };
  }

  // 32 bytes of entropy, URL-safe — the secret half of the sign-in link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // Platform links are stored under PILOT_TENANT_ID for the lookup index — the
  // magic-link create signature is tenant-scoped, but the link is identified as
  // a PLATFORM link by its sentinel profileId, not by tenant. The verify route
  // resolves the platform admin from `createdBy` and builds a tenant-less
  // platform session, so the storage tenant is immaterial.
  const links = getMagicLinkRepository();
  await links.create(PILOT_TENANT_ID, {
    id: randomUUID(),
    profileId: PLATFORM_PROFILE_ID,
    type: 'invite',
    scope: 'edit',
    tokenHash,
    expiresAt: new Date(Date.now() + PLATFORM_LINK_TTL_MS).toISOString(),
    // The verify route reads `createdBy` back as the platform admin's email to
    // seed the session, so the link is self-describing.
    createdBy: email,
  });

  const verifyPath = `/auth/verify?token=${rawToken}`;

  // Get the origin to construct the full URL for the email.
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const verifyUrl = `${protocol}://${host}${verifyPath}`;

  // Send the magic link email (skipped in non-production, logs instead).
  await sendMagicLinkEmail({
    to: email,
    subject: 'Sign in to Bench Platform',
    verifyUrl,
    tenantName: 'Bench Platform',
  });

  // In dev, also surface the link directly for testing.
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true, devLink: verifyPath };
  }

  return { ok: true };
}

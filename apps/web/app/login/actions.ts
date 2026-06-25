'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { isAuthorizedAdmin } from '@/lib/auth/admins';
import { PILOT_TENANT_ID } from '@/lib/tenant';

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
 * SECURITY: the response is identical whether or not the email is an authorized
 * admin — we never reveal which emails exist. A link is only minted (and a
 * `devLink` surfaced) when the email is authorized AND we're not in production.
 */
export async function requestAdminLink(
  _prev: AdminLinkState,
  formData: FormData,
): Promise<AdminLinkState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  // Invalid input or not an admin → neutral success, no link minted.
  if (!EMAIL_RE.test(email) || !isAuthorizedAdmin(email)) {
    return { ok: true };
  }

  // 32 bytes of entropy, URL-safe — the secret half of the sign-in link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const links = getMagicLinkRepository();
  await links.create(PILOT_TENANT_ID, {
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

  // TODO(SES): send this link by email in production (Amazon SES). For now we
  // only surface it in dev so the flow works with no email service wired up.

  if (process.env.NODE_ENV !== 'production') {
    return { ok: true, devLink: verifyPath };
  }

  return { ok: true };
}

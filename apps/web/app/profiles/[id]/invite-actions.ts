'use server';

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getRepository } from '@/lib/data/repository';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { PILOT_TENANT_ID } from '@/lib/tenant';

/** Consultant invites are valid for 14 days. */
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Mint an invite link for a consultant to claim and build their own profile.
 *
 * The raw token is returned to the owner exactly once (as a relative
 * `/invite/{raw}` path); only its SHA-256 hash is persisted. Minting also moves
 * the profile to `invited` so the dashboard reflects that an invite is out.
 *
 * The caller composes the absolute URL from the request origin and shares it
 * with the consultant. TODO(SES): email this link in production.
 */
export async function sendInvite(profileId: string): Promise<string> {
  // 32 bytes of entropy, URL-safe — the secret half of the invite link.
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const links = getMagicLinkRepository();
  await links.create(PILOT_TENANT_ID, {
    id: randomUUID(),
    profileId,
    type: 'invite',
    scope: 'edit',
    tokenHash,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    createdBy: 'owner',
  });

  await getRepository().setStatus(PILOT_TENANT_ID, profileId, 'invited');

  revalidatePath(`/profiles/${profileId}`);
  revalidatePath('/dashboard');

  return `/invite/${rawToken}`;
}

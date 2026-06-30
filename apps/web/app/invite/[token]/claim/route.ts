import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { createSession } from '@/lib/auth/session';

/**
 * Claim an invite: POST /invite/[token]/claim
 *
 * Re-validates the token (single source of truth — the page's check is only for
 * display), seeds a member session scoped to the invited profile, single-uses
 * the link, then redirects into the edit wizard.
 *
 * On any validation failure, redirect back to the public claim page so it shows
 * the neutral "no longer valid" state.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const invalid = () =>
    NextResponse.redirect(new URL(`/invite/${token}`, request.url));

  if (!token) return invalid();

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = getMagicLinkRepository();
  const lookup = await links.lookupByTokenHash(tokenHash);

  if (!lookup) return invalid();
  if (lookup.status !== 'active') return invalid();
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return invalid();
  if (lookup.type !== 'invite') return invalid();
  if (lookup.scope !== 'edit') return invalid();
  // Sentinel links have their own routes: BUILDER → /build, ADMIN → /auth/verify.
  // Claiming one here would mis-scope a member session and (for BUILDER) burn a
  // reusable link. Reject them.
  if (lookup.profileId === 'BUILDER' || lookup.profileId === 'ADMIN') return invalid();

  await createSession({
    kind: 'member',
    tenantId: lookup.tenantId,
    profileId: lookup.profileId,
    scope: 'edit',
  });

  // Single-use: burn the link so it can't be replayed by another person.
  await links.markAsUsed(lookup.tenantId, lookup.profileId, lookup.id);

  return NextResponse.redirect(
    new URL(`/profiles/${lookup.profileId}/edit`, request.url),
  );
}

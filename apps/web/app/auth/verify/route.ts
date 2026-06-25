import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { createSession } from '@/lib/auth/session';
import { PILOT_TENANT_ID } from '@/lib/tenant';

/** Sentinel profile id under which admin (owner) magic links are stored. */
const ADMIN_PROFILE_ID = 'ADMIN';

/**
 * Verify an admin sign-in link.
 *
 * GET /auth/verify?token=<raw>
 *
 * Re-hashes the raw token, resolves it via GSI3 (`lookupByTokenHash`) to recover
 * tenant context, then validates it is an active, unexpired, edit-scoped invite
 * for THIS tenant's ADMIN slot. It reads the link back by id to recover the
 * issuing admin email (`createdBy`), seeds an admin session, single-uses the
 * link, and redirects to the dashboard. Any failure → /login?error=invalid.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const invalid = () =>
    NextResponse.redirect(new URL('/login?error=invalid', request.url));

  if (!token) return invalid();

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = getMagicLinkRepository();
  const lookup = await links.lookupByTokenHash(tokenHash);

  if (!lookup) return invalid();
  if (lookup.status !== 'active') return invalid();
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return invalid();
  if (lookup.type !== 'invite') return invalid();
  if (lookup.scope !== 'edit') return invalid();
  if (lookup.tenantId !== PILOT_TENANT_ID) return invalid();
  if (lookup.profileId !== ADMIN_PROFILE_ID) return invalid();

  // Read the full link to recover the admin email it was minted for.
  const link = await links.findById(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);
  if (!link || !link.createdBy) return invalid();

  await createSession({
    kind: 'admin',
    tenantId: lookup.tenantId,
    email: link.createdBy,
    role: 'owner',
  });

  // Single-use: burn the link so the URL can't be replayed.
  await links.markAsUsed(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);

  return NextResponse.redirect(new URL('/dashboard', request.url));
}

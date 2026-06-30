import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getRepository } from '@/lib/data/repository';
import { createSession } from '@/lib/auth/session';

/** Sentinel profileId under which a tenant's reusable builder link is stored. */
const BUILDER_PROFILE_ID = 'BUILDER';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Start a new consultant from a reusable per-tenant builder link.
 *
 * POST /build/[token]/start  (name, email)
 *
 * Re-validates the builder token (single source of truth), creates a fresh
 * consultant record, moves it to `draft`, mints a member session scoped to
 * the new profile, and redirects into the edit wizard. The builder link is
 * REUSABLE — it is NOT burned, so the admin can hand the same link to many new
 * consultants. Expiry (TTL) is the abuse guard.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const back = (q = '') =>
    NextResponse.redirect(new URL(`/build/${token}${q}`, request.url));

  if (!token) return back();

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = getMagicLinkRepository();
  const lookup = await links.lookupByTokenHash(tokenHash);

  // Must be an active, unexpired, edit-scoped BUILDER invite for this to be a
  // valid record-less builder link (distinct from per-consultant/admin invites).
  if (
    !lookup ||
    lookup.status !== 'active' ||
    new Date(lookup.expiresAt).getTime() <= Date.now() ||
    lookup.type !== 'invite' ||
    lookup.scope !== 'edit' ||
    lookup.profileId !== BUILDER_PROFILE_ID
  ) {
    return back();
  }

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  if (name.length < 2 || !EMAIL_RE.test(email)) {
    return back('?error=details');
  }

  // Create the consultant record, then mark as draft (they're about to build).
  const repo = getRepository();
  const profile = await repo.create(lookup.tenantId, { name, email });
  await repo.setStatus(lookup.tenantId, profile.id, 'draft');

  // Member session scoped to the NEW profile — middleware lets a member edit only
  // their own profile id.
  await createSession({
    kind: 'member',
    tenantId: lookup.tenantId,
    profileId: profile.id,
    scope: 'edit',
  });

  // REUSABLE: do not burn the builder link.
  return NextResponse.redirect(
    new URL(`/profiles/${profile.id}/edit`, request.url),
  );
}

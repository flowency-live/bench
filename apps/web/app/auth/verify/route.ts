import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/auth/platform';
import { setPendingInvite, getPendingInvite } from '@/lib/auth/pending-invite';
import { completeAuthentication } from '@/lib/auth/complete-auth';

/** Sentinel profile id under which admin (owner) magic links are stored. */
const ADMIN_PROFILE_ID = 'ADMIN';

/** Sentinel profile id under which platform (godmode) magic links are stored. */
const PLATFORM_PROFILE_ID = 'PLATFORM';

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
  // In Amplify SSR, request.url returns localhost. Use host header.
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const token = request.nextUrl.searchParams.get('token');
  const invalid = () => NextResponse.redirect(`${origin}/login?error=invalid`);

  if (!token) return invalid();

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = getMagicLinkRepository();
  const lookup = await links.lookupByTokenHash(tokenHash);

  if (!lookup) return invalid();
  if (lookup.status !== 'active') return invalid();
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return invalid();
  // Accept both 'invite' (shareable onboarding) and 'signin' (returning user magic link)
  if (lookup.type !== 'invite' && lookup.type !== 'signin') return invalid();
  if (lookup.scope !== 'edit') return invalid();

  // ── Platform (godmode) branch — NOT tenant-bound (ADR-0010). ──────────────
  // A PLATFORM link seeds a tenant-less platform session; the admin email is
  // recovered from `createdBy` and must still be an allowlisted platform admin.
  if (lookup.profileId === PLATFORM_PROFILE_ID) {
    const link = await links.findById(
      lookup.tenantId,
      PLATFORM_PROFILE_ID,
      lookup.id,
    );
    if (!link || !link.createdBy) return invalid();

    const email = link.createdBy.trim().toLowerCase();
    if (!isPlatformAdmin(email)) {
      // Redirect to the godmode login on a non-allowlisted email.
      return NextResponse.redirect(`${origin}/godmode/login?error=invalid`);
    }

    await createSession({ kind: 'platform', email });

    // Single-use: burn the link so the URL can't be replayed.
    await links.markAsUsed(lookup.tenantId, PLATFORM_PROFILE_ID, lookup.id);

    return NextResponse.redirect(`${origin}/godmode`);
  }

  // ── Admin (tenant owner) branch — multi-tenant (ADR-0010 §Phase 1). ────────
  // Trust lookup.tenantId from GSI3 resolution — no PILOT_TENANT_ID restriction.
  if (lookup.profileId !== ADMIN_PROFILE_ID) return invalid();

  // Read the full link to recover the admin email it was minted for.
  const link = await links.findById(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);
  if (!link || !link.createdBy) return invalid();

  // Parse createdBy: godmode links use "email|tenantId" format, regular login
  // links use just "email". Extract the email portion.
  const createdByParts = link.createdBy.split('|');
  const emailPart = createdByParts[0];
  if (!emailPart) return invalid();
  const email = emailPart.trim().toLowerCase();
  if (!email) return invalid();

  // Look up the user to verify they exist in this tenant.
  const users = getUserRepository();
  const user = await users.getByEmail(email);

  // Verify user exists in this tenant
  if (!user || user.tenantId !== lookup.tenantId) {
    return invalid();
  }

  // ── ADR-0014: Invite ≠ Authentication ──────────────────────────────────────
  // An invite link does NOT create a session by itself. It holds the invite
  // in a signed cookie and redirects to /login for identity verification.
  // The token is burned ONLY after successful identity binding.
  //
  // For type='signin' links (returning users who requested a magic link from
  // /login), the email delivery itself proves identity, so we can create
  // a session directly. But type='invite' (shareable onboarding links) must
  // require identity verification first.

  if (lookup.type === 'signin') {
    // A sign-in link is emailed only to the user's own inbox, so clicking it
    // proves identity. If the user is mid-flow on an invite (a first-time,
    // still-pending admin who chose the EMAIL method), a matching pending invite
    // is held — complete the claim through the shared handler, which activates
    // pending->active, binds, and burns the original invite token (ADR-0014).
    // This closes the gap where a pending admin could only finish via social or
    // phone, never email.
    const pending = await getPendingInvite();
    if (
      pending &&
      pending.tenantId === lookup.tenantId &&
      pending.email.trim().toLowerCase() === email
    ) {
      const result = await completeAuthentication(email);
      // Burn THIS sign-in link too (single-use), whatever the outcome.
      await links.markAsUsed(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);
      if (!result.success) return invalid();
      return NextResponse.redirect(`${origin}${result.redirectTo}`);
    }

    // Returning user sign-in (no pending invite): must be an active admin.
    if (user.status !== 'active') {
      // Pending or inactive users should use the invite flow, not signin.
      return invalid();
    }
    if (user.role !== 'admin') {
      // Non-admin users can't sign in via the admin path
      // (they would use consultant magic links for their profile).
      return invalid();
    }

    await createSession({
      kind: 'admin',
      tenantId: lookup.tenantId,
      email,
      role: 'owner',
    });

    // Burn the sign-in link (single-use).
    await links.markAsUsed(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);

    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // For invite links: hold the invite, require identity verification.
  // DO NOT burn the token yet — re-clicks should work until auth succeeds.
  await setPendingInvite({
    tenantId: lookup.tenantId,
    profileId: ADMIN_PROFILE_ID,
    role: 'admin',
    tokenHash,
    linkId: lookup.id,
    expiresAt: lookup.expiresAt,
    email,
  });

  // Redirect to login for identity verification
  return NextResponse.redirect(`${origin}/login?pending=admin`);
}

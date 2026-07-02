import { NextResponse, type NextRequest } from 'next/server';
import { hashToken } from '@bench/domain/magic-link';
import { getPortalLinkRepository, getClientContactRepository } from '@/lib/data/client';
import {
  signToken,
  nowSeconds,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type ClientSession,
} from '@/lib/auth/session-token';

/**
 * Portal magic link handler.
 *
 * Validates the token, creates a ClientSession, and redirects to /portal.
 * Single-use: marks the link as 'used' after successful validation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!token) {
    return redirectToError(request, 'missing_token');
  }

  // Hash the token to look up in database
  const tokenHash = hashToken(token);

  // Look up the link (cross-tenant via GSI3)
  const lookup = await getPortalLinkRepository().lookupByTokenHash(tokenHash);

  if (!lookup) {
    return redirectToError(request, 'not_found');
  }

  // Validate status
  if (lookup.status !== 'active') {
    return redirectToError(request, lookup.status === 'used' ? 'already_used' : 'invalid');
  }

  // Validate expiry
  const now = new Date();
  const expiresAt = new Date(lookup.expiresAt);
  if (now > expiresAt) {
    return redirectToError(request, 'expired');
  }

  // Mark as used (single-use enforcement)
  try {
    await getPortalLinkRepository().markAsUsed(lookup.tenantId, lookup.clientId, lookup.id);
  } catch {
    // If marking fails, the link may have been used by another request
    return redirectToError(request, 'already_used');
  }

  // Update contact's last login
  try {
    await getClientContactRepository().updateLastLogin(
      lookup.tenantId,
      lookup.clientId,
      lookup.contactId,
    );
  } catch {
    // Non-critical, continue with session creation
  }

  // Create client session
  const exp = nowSeconds() + SESSION_TTL_SECONDS;
  const sessionPayload: ClientSession = {
    kind: 'client',
    tenantId: lookup.tenantId,
    clientId: lookup.clientId,
    contactId: lookup.contactId,
    contactEmail: lookup.contactEmail,
    exp,
  };

  const sessionToken = await signToken(sessionPayload);

  // Redirect to portal and set session cookie
  const response = NextResponse.redirect(new URL('/portal', request.url));
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

function redirectToError(request: NextRequest, reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/portal/error?reason=${encodeURIComponent(reason)}`, request.url),
  );
}

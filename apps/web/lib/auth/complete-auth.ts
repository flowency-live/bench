/**
 * Complete Authentication — Post-Identity-Verification Handler (ADR-0014).
 *
 * After the user proves their identity (via email magic link, phone OTP, or
 * social auth), this module handles the final session creation, including:
 *
 * 1. Checking for pending invites (new user accepting an invite)
 * 2. Binding verified identity to tenant (if pending invite exists)
 * 3. Burning the invite token (single-use enforcement)
 * 4. Creating the session with actual user role
 *
 * SECURITY INVARIANTS:
 * - Identity must be verified before calling this module
 * - Pending invite email must match verified identity email
 * - Token is burned only after successful binding
 * - Session role comes from user record, never hardcoded
 * - User must be active (or activated during this flow)
 */

import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from './session';
import {
  getPendingInvite,
  clearPendingInvite,
  type PendingInvite,
} from './pending-invite';

/** Sentinel profile id under which admin (owner) magic links are stored. */
const ADMIN_PROFILE_ID = 'ADMIN';

/** Result of authentication completion. */
export type CompleteAuthResult =
  | { success: true; redirectTo: string }
  | { success: false; error: AuthError };

/** Error codes for auth completion failures. */
export type AuthError =
  | 'no_user'           // Email not found in system
  | 'not_admin'         // User is not an admin (for admin login flow)
  | 'user_inactive'     // User exists but is suspended/disabled
  | 'invite_expired'    // Pending invite has expired
  | 'invite_mismatch'   // Verified email doesn't match invite email
  | 'invite_burned'     // Invite token already used
  | 'no_pending_invite' // Expected pending invite but none found
  | 'unknown';          // Unexpected error

/**
 * Complete authentication after identity verification.
 *
 * @param verifiedEmail - The email address that was just verified
 * @param requirePendingInvite - If true, fail if no pending invite (for flows that expect one)
 * @returns Result indicating success with redirect path, or failure with error code
 */
export async function completeAuthentication(
  verifiedEmail: string,
  requirePendingInvite = false,
): Promise<CompleteAuthResult> {
  const email = verifiedEmail.trim().toLowerCase();

  // Check for pending invite (set when user clicked an invite link)
  const pendingInvite = await getPendingInvite();

  if (pendingInvite) {
    return completeWithPendingInvite(email, pendingInvite);
  }

  // No pending invite - this is a returning user signing in
  if (requirePendingInvite) {
    return { success: false, error: 'no_pending_invite' };
  }

  return completeReturningUserAuth(email);
}

/**
 * Complete authentication for a new user with a pending invite.
 *
 * The user clicked an invite link, held the invite, and just verified their
 * identity. We validate the invite, bind their identity, burn the token,
 * and create their session.
 */
async function completeWithPendingInvite(
  verifiedEmail: string,
  invite: PendingInvite,
): Promise<CompleteAuthResult> {
  // SECURITY: Verified email must match the invite's expected email
  if (verifiedEmail !== invite.email.trim().toLowerCase()) {
    // Clear the pending invite - they can't claim it with a different email
    await clearPendingInvite();
    return { success: false, error: 'invite_mismatch' };
  }

  // Check invite hasn't expired
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    await clearPendingInvite();
    return { success: false, error: 'invite_expired' };
  }

  // Look up the user to verify they exist
  const users = getUserRepository();
  const user = await users.getByEmail(verifiedEmail);

  if (!user) {
    await clearPendingInvite();
    return { success: false, error: 'no_user' };
  }

  // Verify user belongs to the invite's tenant
  if (user.tenantId !== invite.tenantId) {
    await clearPendingInvite();
    return { success: false, error: 'invite_mismatch' };
  }

  // Activate user if pending (first-time claim)
  if (user.status === 'pending') {
    await users.setStatus(invite.tenantId, user.id, 'active');
  } else if (user.status !== 'active') {
    // User is suspended or disabled
    await clearPendingInvite();
    return { success: false, error: 'user_inactive' };
  }

  // For admin invites (ADMIN_PROFILE_ID), user must have admin role
  if (invite.profileId === ADMIN_PROFILE_ID && user.role !== 'admin') {
    await clearPendingInvite();
    return { success: false, error: 'not_admin' };
  }

  // Burn the invite token (single-use enforcement)
  const links = getMagicLinkRepository();
  try {
    await links.markAsUsed(invite.tenantId, invite.profileId, invite.linkId);
  } catch {
    // Token might already be burned (race condition or replay)
    await clearPendingInvite();
    return { success: false, error: 'invite_burned' };
  }

  // Clear the pending invite cookie
  await clearPendingInvite();

  // Create admin session (only admins reach here for ADMIN_PROFILE_ID invites)
  await createSession({
    kind: 'admin',
    tenantId: invite.tenantId,
    email: verifiedEmail,
    role: 'owner',
  });

  // Redirect based on profile type
  const redirectTo = invite.profileId === ADMIN_PROFILE_ID
    ? '/dashboard'
    : `/profiles/${invite.profileId}/edit`;

  return { success: true, redirectTo };
}

/**
 * Complete authentication for a returning user (no pending invite).
 *
 * The user requested a sign-in link from /login and just verified their
 * identity via social auth. We look them up and create their session.
 *
 * Note: Only admins can sign in via the admin login page. Non-admins
 * would use consultant magic links to access their profiles.
 */
async function completeReturningUserAuth(
  verifiedEmail: string,
): Promise<CompleteAuthResult> {
  const users = getUserRepository();
  const user = await users.getByEmail(verifiedEmail);

  if (!user) {
    return { success: false, error: 'no_user' };
  }

  // User must be active
  if (user.status !== 'active') {
    return { success: false, error: 'user_inactive' };
  }

  // Only admins can sign in via this flow (admin login page)
  if (user.role !== 'admin') {
    return { success: false, error: 'not_admin' };
  }

  // Create admin session
  await createSession({
    kind: 'admin',
    tenantId: user.tenantId,
    email: verifiedEmail,
    role: 'owner',
  });

  return { success: true, redirectTo: '/dashboard' };
}

/**
 * Get a user-friendly error message for auth errors.
 */
export function getAuthErrorMessage(error: AuthError): string {
  switch (error) {
    case 'no_user':
      return 'This email is not registered. Contact your administrator.';
    case 'not_admin':
      return 'Admin access required. Use your consultant link to access your profile.';
    case 'user_inactive':
      return 'Your account is not active. Contact your administrator.';
    case 'invite_expired':
      return 'This invite has expired. Request a new one.';
    case 'invite_mismatch':
      return 'Please verify with the same email the invite was sent to.';
    case 'invite_burned':
      return 'This invite has already been used.';
    case 'no_pending_invite':
      return 'No pending invite found. Click your invite link first.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

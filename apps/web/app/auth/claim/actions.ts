'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from '@/lib/auth/session';
import { signUp, CognitoError } from '@/lib/auth/cognito';

/** Sentinel profile id under which admin (owner) magic links are stored. */
const ADMIN_PROFILE_ID = 'ADMIN';

/** State returned to the claim form. */
export interface ClaimState {
  readonly ok: boolean;
  readonly error?: string;
}

/** Token data validated from the magic link. */
export interface ValidatedToken {
  readonly valid: boolean;
  readonly email?: string;
  readonly tenantId?: string;
  readonly linkId?: string;
}

/**
 * Validate a claim token and return the associated email/tenant.
 * Used by the claim page to pre-fill the form.
 */
export async function validateToken(token: string): Promise<ValidatedToken> {
  if (!token) return { valid: false };

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = getMagicLinkRepository();
  const lookup = await links.lookupByTokenHash(tokenHash);

  if (!lookup) return { valid: false };
  if (lookup.status !== 'active') return { valid: false };
  if (new Date(lookup.expiresAt).getTime() <= Date.now()) return { valid: false };
  if (lookup.type !== 'invite') return { valid: false };
  if (lookup.scope !== 'edit') return { valid: false };
  if (lookup.profileId !== ADMIN_PROFILE_ID) return { valid: false };

  // Read the full link to recover the admin email.
  const link = await links.findById(lookup.tenantId, ADMIN_PROFILE_ID, lookup.id);
  if (!link || !link.createdBy) return { valid: false };

  // Parse createdBy: godmode links use "email|tenantId" format.
  const createdByParts = link.createdBy.split('|');
  const emailPart = createdByParts[0];
  if (!emailPart) return { valid: false };
  const email = emailPart.trim().toLowerCase();

  return {
    valid: true,
    email,
    tenantId: lookup.tenantId,
    linkId: lookup.id,
  };
}

/**
 * Complete the claim by registering with Cognito and creating a session.
 *
 * Steps:
 * 1. Validate the token again
 * 2. Register the user in Cognito
 * 3. Get the Cognito user sub
 * 4. Bind the Cognito identity to the tenant user
 * 5. Create a session
 * 6. Mark the link as used
 * 7. Redirect to dashboard
 */
export async function completeClaim(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  // Validate passwords
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }

  // Validate token
  const validated = await validateToken(token);
  if (!validated.valid || !validated.email || !validated.tenantId || !validated.linkId) {
    return { ok: false, error: 'This link has expired or is invalid. Please request a new one.' };
  }

  const { email, tenantId, linkId } = validated;

  try {
    // Register with Cognito - signUp returns the userSub directly
    const signUpResult = await signUp(email, password);
    const cognitoSub = signUpResult.userSub;
    if (!cognitoSub) {
      return { ok: false, error: 'Failed to retrieve user identity. Please try again.' };
    }

    // Bind the Cognito identity to the tenant user
    const users = getUserRepository();
    const user = await users.getByEmail(email);
    if (user && user.tenantId === tenantId) {
      await users.bindIdentity(tenantId, user.id, cognitoSub);
    }

    // Create session
    await createSession({
      kind: 'admin',
      tenantId,
      email,
      role: 'owner',
    });

    // Mark the link as used
    const links = getMagicLinkRepository();
    await links.markAsUsed(tenantId, ADMIN_PROFILE_ID, linkId);
  } catch (err) {
    if (err instanceof CognitoError) {
      if (err.code === 'USER_EXISTS') {
        // User already registered, they should use password login
        return { ok: false, error: 'An account with this email already exists. Please sign in with your password.' };
      }
      if (err.code === 'INVALID_PASSWORD') {
        return { ok: false, error: err.message };
      }
      return { ok: false, error: err.message };
    }
    console.error('[claim-error]', err);
    return { ok: false, error: 'An unexpected error occurred. Please try again.' };
  }

  // Redirect to dashboard (this must be outside the try/catch to work)
  redirect('/dashboard');
}

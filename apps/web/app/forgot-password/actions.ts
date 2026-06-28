'use server';

import { forgotPassword, CognitoError } from '@/lib/auth/cognito';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** State returned to the forgot password form. */
export interface ForgotPasswordState {
  readonly ok: boolean;
  readonly error?: string;
  /** Email that was submitted (for display on success). */
  readonly email?: string;
}

/**
 * Request a password reset code via Cognito.
 *
 * SECURITY: Always returns success to avoid revealing which emails exist.
 * The actual email is only sent if the account exists in Cognito.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  try {
    await forgotPassword(email);
  } catch (err) {
    // Swallow USER_NOT_FOUND to avoid revealing account existence.
    if (err instanceof CognitoError && err.code === 'USER_NOT_FOUND') {
      // Return success anyway — neutral response.
      return { ok: true, email };
    }
    // Log other errors but still return success for security.
    console.error('[forgot-password-error]', err);
  }

  return { ok: true, email };
}

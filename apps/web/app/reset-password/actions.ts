'use server';

import { redirect } from 'next/navigation';
import { confirmForgotPassword, CognitoError } from '@/lib/auth/cognito';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** State returned to the reset password form. */
export interface ResetPasswordState {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Complete password reset by confirming the code and setting a new password.
 */
export async function completePasswordReset(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (!code || code.length < 4) {
    return { ok: false, error: 'Please enter the verification code from your email.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }

  try {
    await confirmForgotPassword(email, code, password);
  } catch (err) {
    if (err instanceof CognitoError) {
      if (err.code === 'INVALID_CODE') {
        return { ok: false, error: 'Invalid or expired verification code. Please request a new one.' };
      }
      if (err.code === 'INVALID_PASSWORD') {
        return { ok: false, error: err.message };
      }
      if (err.code === 'USER_NOT_FOUND') {
        return { ok: false, error: 'No account found for this email.' };
      }
      return { ok: false, error: err.message };
    }
    console.error('[reset-password-error]', err);
    return { ok: false, error: 'An unexpected error occurred. Please try again.' };
  }

  // Redirect to login with success message (must be outside try/catch).
  redirect('/login?reset=success');
}

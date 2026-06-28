'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getOtpRepository } from '@/lib/data/otp';
import { getPendingInvite } from '@/lib/auth/pending-invite';
import { completeAuthentication, getAuthErrorMessage } from '@/lib/auth/complete-auth';

/** UK phone number regex: +44 or 07 prefix, 10-11 digits total */
const UK_PHONE_RE = /^(?:\+44|0)7\d{9}$/;

/** State for phone OTP flow */
export interface PhoneOtpState {
  readonly step: 'request' | 'verify';
  readonly ok: boolean;
  readonly phone?: string;
  readonly error?: string;
  readonly verified?: boolean;
}

/**
 * Normalize a UK phone number to E.164 format (+447...).
 * Converts 07... to +447...
 */
function normalizeUkPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+44${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * Hash a phone number for storage (privacy).
 */
function hashPhone(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

/**
 * Send OTP code via AWS SNS.
 */
async function sendSms(phone: string, code: string): Promise<void> {
  const sns = new SNSClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });

  await sns.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: `Your Bench code is ${code}. It expires in 5 minutes.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'BENCH',
        },
      },
    }),
  );
}

/**
 * Request a phone OTP code.
 *
 * Validates the phone number, creates an OTP in DynamoDB, and sends it via SMS.
 * Returns neutral success regardless of whether the phone is registered
 * (doesn't reveal which phones have accounts).
 */
export async function requestPhoneOtp(
  _prev: PhoneOtpState,
  formData: FormData,
): Promise<PhoneOtpState> {
  const rawPhone = String(formData.get('phone') ?? '').trim();

  // Remove spaces and dashes for validation
  const cleanPhone = rawPhone.replace(/[\s-]/g, '');

  if (!UK_PHONE_RE.test(cleanPhone)) {
    return {
      step: 'request',
      ok: false,
      error: 'Please enter a valid UK mobile phone number.',
    };
  }

  const phone = normalizeUkPhone(cleanPhone);
  const phoneHash = hashPhone(phone);

  try {
    // Create OTP in DynamoDB
    const otp = getOtpRepository();
    const { code } = await otp.create(phoneHash);

    // Send SMS
    await sendSms(phone, code);

    return {
      step: 'verify',
      ok: true,
      phone,
    };
  } catch (err) {
    console.error('[phone-otp] Failed to send OTP:', err);
    return {
      step: 'request',
      ok: false,
      error: 'Failed to send code. Please try again.',
    };
  }
}

/**
 * Verify a phone OTP code.
 *
 * Checks the code against the stored OTP. On success:
 * - If pending invite: completes auth using the invite's email
 * - If no pending invite: returns error (phone-only auth not yet supported)
 *
 * ADR-0014: Phone OTP proves identity, pending invite provides email context.
 */
export async function verifyPhoneOtp(
  prev: PhoneOtpState,
  formData: FormData,
): Promise<PhoneOtpState> {
  const phone = prev.phone ?? String(formData.get('phone') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();

  if (!/^\d{6}$/.test(code)) {
    return {
      step: 'verify',
      ok: false,
      phone,
      error: 'Please enter a 6-digit code.',
    };
  }

  const phoneHash = hashPhone(normalizeUkPhone(phone));

  try {
    const otp = getOtpRepository();
    const isValid = await otp.verify(phoneHash, code);

    if (!isValid) {
      return {
        step: 'verify',
        ok: false,
        phone,
        error: 'Invalid or expired code. Please try again.',
      };
    }

    // Code verified - check for pending invite to get email context
    const pendingInvite = await getPendingInvite();

    if (!pendingInvite) {
      // No pending invite - phone-only sign-in not yet supported
      // (would need phone field on TenantUser + GSI lookup)
      return {
        step: 'verify',
        ok: false,
        phone,
        error: 'Phone sign-in requires an invite link. Please click your invite first.',
      };
    }

    // Complete authentication using the email from the pending invite
    const result = await completeAuthentication(pendingInvite.email);

    if (!result.success) {
      return {
        step: 'verify',
        ok: false,
        phone,
        error: getAuthErrorMessage(result.error),
      };
    }

    // Redirect to the determined destination
    // Note: redirect() expects typed routes, but we have a dynamic path
    redirect(result.redirectTo as '/dashboard');
  } catch (err) {
    // Handle redirect error (Next.js throws on redirect)
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err;
    }
    console.error('[phone-otp] Verification error:', err);
    return {
      step: 'verify',
      ok: false,
      phone,
      error: 'Verification failed. Please try again.',
    };
  }
}

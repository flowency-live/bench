/**
 * SES Email Send Utility — Phase 4 (ADR-0012).
 *
 * Sends transactional emails via Amazon SES. In non-production environments,
 * emails are logged but not sent (the devLink pattern surfaces links directly).
 *
 * Sender: noreply@opstack.uk (verified domain identity).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const SENDER_EMAIL = 'noreply@opstack.uk';
const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-2';

let sesClient: SESClient | null = null;

function getClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({ region: AWS_REGION });
  }
  return sesClient;
}

/** Parameters for a magic-link sign-in email. */
export interface MagicLinkEmailParams {
  to: string;
  subject: string;
  verifyUrl: string;
  tenantName: string;
}

/** Parameters for a tenant-admin onboarding email. */
export interface OnboardingEmailParams {
  to: string;
  tenantName: string;
  verifyUrl: string;
  invitedBy: string;
}

/** Parameters for a consultant invite email. */
export interface ConsultantInviteEmailParams {
  to: string;
  consultantName: string;
  tenantName: string;
  inviteUrl: string;
}

/**
 * Send a magic-link sign-in email.
 *
 * In non-production, logs instead of sending (the action surfaces devLink).
 */
export async function sendMagicLinkEmail(params: MagicLinkEmailParams): Promise<void> {
  const { to, subject, verifyUrl, tenantName } = params;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[email-skip]', { to, subject, verifyUrl, reason: 'non-production' });
    return;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #001930; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Sign in to ${tenantName}</h1>
  </div>

  <p>Click the button below to sign in. This link expires in 30 minutes.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="background: #BAEB5B; color: #001930; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">
      Sign In
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you didn't request this email, you can safely ignore it.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">
    This email was sent by Bench. If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${verifyUrl}" style="color: #666;">${verifyUrl}</a>
  </p>
</body>
</html>
`.trim();

  const textBody = `
Sign in to ${tenantName}

Click the link below to sign in. This link expires in 30 minutes.

${verifyUrl}

If you didn't request this email, you can safely ignore it.
`.trim();

  await sendEmail({ to, subject, htmlBody, textBody });
}

/**
 * Send a tenant-admin onboarding email (new tenant created via godmode).
 */
export async function sendOnboardingEmail(params: OnboardingEmailParams): Promise<void> {
  const { to, tenantName, verifyUrl, invitedBy } = params;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[email-skip]', { to, tenantName, verifyUrl, reason: 'non-production' });
    return;
  }

  const subject = `You've been invited to manage ${tenantName} on Bench`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #001930; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to ${tenantName}</h1>
  </div>

  <p>You've been invited by <strong>${invitedBy}</strong> to be an administrator for <strong>${tenantName}</strong> on Bench.</p>

  <p>Click the button below to set up your account. This link expires in 30 minutes.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="background: #BAEB5B; color: #001930; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">
      Get Started
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you weren't expecting this invitation, please contact the person who sent it.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">
    This email was sent by Bench. If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${verifyUrl}" style="color: #666;">${verifyUrl}</a>
  </p>
</body>
</html>
`.trim();

  const textBody = `
Welcome to ${tenantName}

You've been invited by ${invitedBy} to be an administrator for ${tenantName} on Bench.

Click the link below to set up your account. This link expires in 30 minutes.

${verifyUrl}

If you weren't expecting this invitation, please contact the person who sent it.
`.trim();

  await sendEmail({ to, subject, htmlBody, textBody });
}

/**
 * Send a consultant invite email.
 */
export async function sendConsultantInviteEmail(params: ConsultantInviteEmailParams): Promise<void> {
  const { to, consultantName, tenantName, inviteUrl } = params;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[email-skip]', { to, consultantName, tenantName, inviteUrl, reason: 'non-production' });
    return;
  }

  const subject = `${tenantName} invites you to build your profile`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #001930; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Build your profile, ${consultantName}</h1>
  </div>

  <p><strong>${tenantName}</strong> has invited you to create your consultant profile on Bench.</p>

  <p>Click the button below to get started. This link expires in 14 days.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${inviteUrl}" style="background: #BAEB5B; color: #001930; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: bold; display: inline-block;">
      Build Your Profile
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you weren't expecting this invitation, please contact ${tenantName}.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">
    This email was sent by Bench. If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${inviteUrl}" style="color: #666;">${inviteUrl}</a>
  </p>
</body>
</html>
`.trim();

  const textBody = `
Build your profile, ${consultantName}

${tenantName} has invited you to create your consultant profile on Bench.

Click the link below to get started. This link expires in 14 days.

${inviteUrl}

If you weren't expecting this invitation, please contact ${tenantName}.
`.trim();

  await sendEmail({ to, subject, htmlBody, textBody });
}

/** Internal: send an email via SES. */
async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<void> {
  const { to, subject, htmlBody, textBody } = params;

  try {
    const command = new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    await getClient().send(command);
    console.info('[email-sent]', { to, subject });
  } catch (err) {
    console.error('[email-error]', {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't throw - email failure shouldn't break the main flow
  }
}

import { createHash } from 'crypto';
import type { MagicLink, MagicLinkScope } from '@bench/types';

/**
 * Result of magic link validation
 */
export type MagicLinkValidationResult =
  | { valid: true; tenantId: string; profileId: string; scope: MagicLinkScope }
  | { valid: false; reason: 'expired' | 'revoked' | 'not_found' | 'invalid_passcode' };

/**
 * Checks if a magic link has expired based on its expiry date.
 *
 * @param link - The magic link to check
 * @returns true if the link has expired
 */
export function isLinkExpired(link: MagicLink): boolean {
  const expiresAt = new Date(link.expiresAt);
  const now = new Date();
  return expiresAt <= now;
}

/**
 * Checks if a magic link is in active status.
 *
 * @param link - The magic link to check
 * @returns true if the link status is 'active'
 */
export function isLinkActive(link: MagicLink): boolean {
  return link.status === 'active';
}

/**
 * Validates a magic link for use.
 *
 * Checks:
 * 1. Status is active (not revoked, used, or expired)
 * 2. Expiry date has not passed
 * 3. Passcode matches (if link has a passcode)
 *
 * @param link - The magic link to validate
 * @param passcode - Optional passcode for protected links
 * @returns Validation result with profile access info or rejection reason
 */
export function validateMagicLink(
  link: MagicLink,
  passcode?: string
): MagicLinkValidationResult {
  // Check status first
  if (link.status === 'revoked') {
    return { valid: false, reason: 'revoked' };
  }

  if (link.status === 'expired' || link.status === 'used') {
    return { valid: false, reason: 'expired' };
  }

  // Check expiry date
  if (isLinkExpired(link)) {
    return { valid: false, reason: 'expired' };
  }

  // Check passcode if required
  if (link.passcodeHash !== null) {
    if (!passcode) {
      return { valid: false, reason: 'invalid_passcode' };
    }

    const providedHash = createHash('sha256').update(passcode).digest('hex');
    if (providedHash !== link.passcodeHash) {
      return { valid: false, reason: 'invalid_passcode' };
    }
  }

  // Link is valid
  return {
    valid: true,
    tenantId: link.tenantId,
    profileId: link.profileId,
    scope: link.scope,
  };
}

import { createHash, timingSafeEqual } from 'crypto';
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

  // Check passcode if required (timing-safe comparison per ADR-0005)
  if (link.passcodeHash !== null) {
    if (!passcode) {
      return { valid: false, reason: 'invalid_passcode' };
    }

    const providedHash = createHash('sha256').update(passcode).digest('hex');
    const storedHash = link.passcodeHash;

    // Guard: ensure equal length (SHA-256 hex is always 64 chars, but be defensive)
    if (providedHash.length !== storedHash.length) {
      return { valid: false, reason: 'invalid_passcode' };
    }

    // Constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (!timingSafeEqual(providedBuffer, storedBuffer)) {
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

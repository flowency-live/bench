import { createHash, randomBytes } from 'crypto';
import type { MagicLinkToken } from '@cchub/types';

/**
 * Generates a cryptographically secure magic link token.
 *
 * Returns both the raw token (to include in URL) and its SHA-256 hash
 * (to store in the database). The raw token is never stored server-side.
 *
 * @returns MagicLinkToken with raw (URL-safe) and hash (for storage)
 */
export function generateMagicLinkToken(): MagicLinkToken {
  // Generate 32 bytes of cryptographically secure random data
  const raw = randomBytes(32).toString('base64url');

  // Hash for storage - never store the raw token
  const hash = createHash('sha256').update(raw).digest('hex');

  return { raw, hash };
}

/**
 * Hashes a raw token for validation.
 *
 * When a user presents a token, we hash it and look up the hash in the database.
 * This ensures we never store or compare raw tokens.
 *
 * @param raw - The raw token from the URL
 * @returns SHA-256 hash of the token
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

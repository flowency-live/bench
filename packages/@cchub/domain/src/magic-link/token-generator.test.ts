import { describe, test, expect } from 'vitest';
import { generateMagicLinkToken, hashToken } from './token-generator';

describe('Token Generator', () => {
  describe('generateMagicLinkToken', () => {
    test('generates URL-safe base64 token', () => {
      const token = generateMagicLinkToken();

      // URL-safe base64 only contains A-Z, a-z, 0-9, -, _
      expect(token.raw).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('generates token of correct length (32 bytes = 43 chars in base64url)', () => {
      const token = generateMagicLinkToken();

      expect(token.raw.length).toBe(43);
    });

    test('generates unique tokens on each call', () => {
      const token1 = generateMagicLinkToken();
      const token2 = generateMagicLinkToken();
      const token3 = generateMagicLinkToken();

      expect(token1.raw).not.toBe(token2.raw);
      expect(token2.raw).not.toBe(token3.raw);
      expect(token1.raw).not.toBe(token3.raw);
    });

    test('generates SHA-256 hash as 64-character hex string', () => {
      const token = generateMagicLinkToken();

      expect(token.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('raw and hash are different', () => {
      const token = generateMagicLinkToken();

      expect(token.raw).not.toBe(token.hash);
    });
  });

  describe('hashToken', () => {
    test('produces same hash as generator for same raw token', () => {
      const token = generateMagicLinkToken();

      expect(hashToken(token.raw)).toBe(token.hash);
    });

    test('produces different hashes for different inputs', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });

    test('produces consistent hash for same input', () => {
      const input = 'consistent-input';

      expect(hashToken(input)).toBe(hashToken(input));
    });

    test('produces 64-character hex string', () => {
      const hash = hashToken('any-input');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

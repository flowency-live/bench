import { describe, test, expect } from 'vitest';
import {
  validateMagicLink,
  isLinkExpired,
  isLinkActive,
  type MagicLinkValidationResult,
} from './link-validation';
import type { MagicLink } from '@bench/types';

function createMockLink(overrides: Partial<MagicLink> = {}): MagicLink {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  return {
    id: 'link-001',
    tenantId: 'tenant-001',
    profileId: 'profile-001',
    type: 'invite',
    tokenHash: 'abc123hash',
    scope: 'edit',
    status: 'active',
    expiresAt: expiresAt.toISOString(),
    passcodeHash: null,
    createdBy: 'user-001',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('Link Validation', () => {
  describe('isLinkExpired', () => {
    test('returns false for link expiring in the future', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const link = createMockLink({ expiresAt: futureDate.toISOString() });

      expect(isLinkExpired(link)).toBe(false);
    });

    test('returns true for link that expired in the past', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const link = createMockLink({ expiresAt: pastDate.toISOString() });

      expect(isLinkExpired(link)).toBe(true);
    });

    test('returns true for link expiring exactly now', () => {
      const now = new Date();
      const link = createMockLink({ expiresAt: now.toISOString() });

      expect(isLinkExpired(link)).toBe(true);
    });
  });

  describe('isLinkActive', () => {
    test('returns true for active status', () => {
      const link = createMockLink({ status: 'active' });
      expect(isLinkActive(link)).toBe(true);
    });

    test('returns false for revoked status', () => {
      const link = createMockLink({ status: 'revoked' });
      expect(isLinkActive(link)).toBe(false);
    });

    test('returns false for used status', () => {
      const link = createMockLink({ status: 'used' });
      expect(isLinkActive(link)).toBe(false);
    });

    test('returns false for expired status', () => {
      const link = createMockLink({ status: 'expired' });
      expect(isLinkActive(link)).toBe(false);
    });
  });

  describe('validateMagicLink', () => {
    test('returns valid result for active, non-expired link', () => {
      const link = createMockLink();

      const result = validateMagicLink(link);

      expect(result).toEqual<MagicLinkValidationResult>({
        valid: true,
        tenantId: 'tenant-001',
        profileId: 'profile-001',
        scope: 'edit',
      });
    });

    test('returns invalid with reason "expired" for expired link', () => {
      const pastDate = new Date(Date.now() - 1000);
      const link = createMockLink({ expiresAt: pastDate.toISOString() });

      const result = validateMagicLink(link);

      expect(result).toEqual<MagicLinkValidationResult>({
        valid: false,
        reason: 'expired',
      });
    });

    test('returns invalid with reason "revoked" for revoked link', () => {
      const link = createMockLink({ status: 'revoked' });

      const result = validateMagicLink(link);

      expect(result).toEqual<MagicLinkValidationResult>({
        valid: false,
        reason: 'revoked',
      });
    });

    test('returns invalid with reason "expired" for expired status (even if date is future)', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      const link = createMockLink({
        status: 'expired',
        expiresAt: futureDate.toISOString(),
      });

      const result = validateMagicLink(link);

      expect(result).toEqual<MagicLinkValidationResult>({
        valid: false,
        reason: 'expired',
      });
    });

    test('returns view scope for share link type', () => {
      const link = createMockLink({ type: 'share', scope: 'view' });

      const result = validateMagicLink(link);

      expect(result).toEqual<MagicLinkValidationResult>({
        valid: true,
        tenantId: 'tenant-001',
        profileId: 'profile-001',
        scope: 'view',
      });
    });

    test('validates passcode when link has passcodeHash', () => {
      // SHA-256 of "1234"
      const passcodeHash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
      const link = createMockLink({ passcodeHash });

      // Without passcode
      const resultWithoutPasscode = validateMagicLink(link);
      expect(resultWithoutPasscode).toEqual<MagicLinkValidationResult>({
        valid: false,
        reason: 'invalid_passcode',
      });

      // With wrong passcode
      const resultWithWrongPasscode = validateMagicLink(link, 'wrong');
      expect(resultWithWrongPasscode).toEqual<MagicLinkValidationResult>({
        valid: false,
        reason: 'invalid_passcode',
      });

      // With correct passcode
      const resultWithCorrectPasscode = validateMagicLink(link, '1234');
      expect(resultWithCorrectPasscode).toEqual<MagicLinkValidationResult>({
        valid: true,
        tenantId: 'tenant-001',
        profileId: 'profile-001',
        scope: 'edit',
      });
    });
  });
});

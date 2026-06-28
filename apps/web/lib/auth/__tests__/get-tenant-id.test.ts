/**
 * getTenantId() helper tests
 *
 * Extracts the active tenant ID from any session type.
 * Per ADR-0010: used to replace hardcoded PILOT_TENANT_ID with session-derived tenant.
 */
import { describe, it, expect } from 'vitest';
import type { AdminSession, MemberSession, PlatformSession, Session } from '../session-token';
import { getTenantId } from '../session';

describe('getTenantId', () => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour from now

  describe('AdminSession', () => {
    it('returns tenantId from admin session', () => {
      const session: AdminSession = {
        kind: 'admin',
        tenantId: 'acme-corp',
        email: 'admin@acme.com',
        role: 'owner',
        exp,
      };

      expect(getTenantId(session)).toBe('acme-corp');
    });
  });

  describe('MemberSession', () => {
    it('returns tenantId from member session', () => {
      const session: MemberSession = {
        kind: 'member',
        tenantId: 'acme-corp',
        profileId: 'profile-123',
        scope: 'edit',
        exp,
      };

      expect(getTenantId(session)).toBe('acme-corp');
    });
  });

  describe('PlatformSession', () => {
    it('returns null when no activeTenantId is set', () => {
      const session: PlatformSession = {
        kind: 'platform',
        email: 'jason@flowency.co.uk',
        exp,
      };

      expect(getTenantId(session)).toBeNull();
    });

    it('returns activeTenantId when godmode has switched into a tenant', () => {
      const session: PlatformSession = {
        kind: 'platform',
        email: 'jason@flowency.co.uk',
        activeTenantId: 'change-connected',
        exp,
      };

      expect(getTenantId(session)).toBe('change-connected');
    });
  });

  describe('null/invalid session', () => {
    it('returns null for null session', () => {
      expect(getTenantId(null)).toBeNull();
    });

    it('returns null for undefined session', () => {
      expect(getTenantId(undefined as unknown as Session | null)).toBeNull();
    });
  });
});

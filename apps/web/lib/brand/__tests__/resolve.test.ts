/**
 * Brand resolution tests (ADR-0013)
 *
 * Brand resolution order:
 * 1. Logged-in session → session.tenantId (platform → activeTenantId)
 * 2. Explicit tenant (magic-link/share/invite token resolution)
 * 3. None → BENCH_DEFAULT_BRAND
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrandTokens, Tenant } from '@bench/types';

// Mock dependencies before importing
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  getTenantId: vi.fn(),
}));

vi.mock('@/lib/data/tenant', () => ({
  getTenantRepository: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

import { getSession, getTenantId } from '@/lib/auth/session';
import { getTenantRepository } from '@/lib/data/tenant';
import {
  BENCH_DEFAULT_BRAND,
  getActiveTenant,
  getActiveBrand,
  brandStyle,
} from '../resolve';

const mockGetSession = vi.mocked(getSession);
const mockGetTenantId = vi.mocked(getTenantId);
const mockGetTenantRepository = vi.mocked(getTenantRepository);

const TEST_BRAND: BrandTokens = {
  bgPrimary: '#112233',
  bgPanel: '#223344',
  accent: '#ff0000',
  textPrimary: '#ffffff',
  textSecondary: '#cccccc',
  fontDisplay: 'Arial',
  fontBody: 'Georgia',
  logoAssetId: 'logo-123',
};

const TEST_TENANT: Tenant = {
  id: 'test-tenant',
  name: 'Test Company',
  instanceName: 'Test Hub',
  slug: 'test-tenant',
  brandTokens: TEST_BRAND,
  customDomain: null,
  status: 'active',
  trialEndsAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Brand Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BENCH_DEFAULT_BRAND', () => {
    it('has all required fields', () => {
      expect(BENCH_DEFAULT_BRAND.bgPrimary).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.bgPanel).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.accent).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.textPrimary).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.textSecondary).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.fontDisplay).toBeDefined();
      expect(BENCH_DEFAULT_BRAND.fontBody).toBeDefined();
    });
  });

  describe('getActiveTenant', () => {
    it('returns tenant from admin session', async () => {
      mockGetSession.mockResolvedValue({
        kind: 'admin',
        tenantId: 'test-tenant',
        email: 'admin@test.com',
        role: 'admin',
        exp: Date.now() / 1000 + 3600,
      });
      mockGetTenantId.mockReturnValue('test-tenant');
      mockGetTenantRepository.mockReturnValue({
        get: vi.fn().mockResolvedValue(TEST_TENANT),
        list: vi.fn(),
        create: vi.fn(),
        setStatus: vi.fn(),
        delete: vi.fn(),
      });

      const tenant = await getActiveTenant();

      expect(tenant).toEqual(TEST_TENANT);
      expect(mockGetTenantRepository().get).toHaveBeenCalledWith('test-tenant');
    });

    it('returns tenant from platform session with activeTenantId', async () => {
      mockGetSession.mockResolvedValue({
        kind: 'platform',
        email: 'admin@flowency.co.uk',
        activeTenantId: 'test-tenant',
        exp: Date.now() / 1000 + 3600,
      });
      mockGetTenantId.mockReturnValue('test-tenant');
      mockGetTenantRepository.mockReturnValue({
        get: vi.fn().mockResolvedValue(TEST_TENANT),
        list: vi.fn(),
        create: vi.fn(),
        setStatus: vi.fn(),
        delete: vi.fn(),
      });

      const tenant = await getActiveTenant();

      expect(tenant).toEqual(TEST_TENANT);
    });

    it('returns null for platform session without activeTenantId', async () => {
      mockGetSession.mockResolvedValue({
        kind: 'platform',
        email: 'admin@flowency.co.uk',
        exp: Date.now() / 1000 + 3600,
      });
      mockGetTenantId.mockReturnValue(null);

      const tenant = await getActiveTenant();

      expect(tenant).toBeNull();
    });

    it('returns null when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);
      mockGetTenantId.mockReturnValue(null);

      const tenant = await getActiveTenant();

      expect(tenant).toBeNull();
    });

    it('accepts explicit tenant parameter (for token-based pages)', async () => {
      const tenant = await getActiveTenant(TEST_TENANT);

      expect(tenant).toEqual(TEST_TENANT);
      // Should not call session or repo
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  describe('getActiveBrand', () => {
    it('returns tenant brand when tenant exists', async () => {
      mockGetSession.mockResolvedValue({
        kind: 'admin',
        tenantId: 'test-tenant',
        email: 'admin@test.com',
        role: 'admin',
        exp: Date.now() / 1000 + 3600,
      });
      mockGetTenantId.mockReturnValue('test-tenant');
      mockGetTenantRepository.mockReturnValue({
        get: vi.fn().mockResolvedValue(TEST_TENANT),
        list: vi.fn(),
        create: vi.fn(),
        setStatus: vi.fn(),
        delete: vi.fn(),
      });

      const brand = await getActiveBrand();

      expect(brand).toEqual(TEST_BRAND);
    });

    it('returns BENCH_DEFAULT_BRAND when no tenant', async () => {
      mockGetSession.mockResolvedValue(null);
      mockGetTenantId.mockReturnValue(null);

      const brand = await getActiveBrand();

      expect(brand).toEqual(BENCH_DEFAULT_BRAND);
    });

    it('accepts explicit tenant parameter', async () => {
      const brand = await getActiveBrand(TEST_TENANT);

      expect(brand).toEqual(TEST_BRAND);
    });
  });

  describe('brandStyle', () => {
    it('maps BrandTokens to CSS custom properties', () => {
      const style = brandStyle(TEST_BRAND);

      expect(style['--color-bg-primary']).toBe('#112233');
      expect(style['--color-bg-panel']).toBe('#223344');
      expect(style['--color-accent']).toBe('#ff0000');
      expect(style['--color-text-primary']).toBe('#ffffff');
      expect(style['--color-text-secondary']).toBe('#cccccc');
    });

    it('includes font variables', () => {
      const style = brandStyle(TEST_BRAND);

      expect(style['--font-display']).toBe('Arial');
      expect(style['--font-body']).toBe('Georgia');
    });

    it('returns object suitable for React style prop', () => {
      const style = brandStyle(TEST_BRAND);

      // Should be a plain object with string values
      expect(typeof style).toBe('object');
      Object.values(style).forEach((val) => {
        expect(typeof val).toBe('string');
      });
    });
  });
});

/**
 * Godmode brand settings action tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth/platform', () => ({
  getPlatformSession: vi.fn(),
}));

vi.mock('@/lib/data/tenant', () => ({
  getTenantRepository: vi.fn(),
}));

vi.mock('@bench/data', () => ({
  createTenantRepository: vi.fn(),
  createClient: vi.fn(() => ({})),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateTenantBrandSettings, uploadTenantLogo } from '../brand-actions';
import { getPlatformSession } from '@/lib/auth/platform';
import { getTenantRepository } from '@/lib/data/tenant';
import { createTenantRepository, createClient } from '@bench/data';

describe('updateTenantBrandSettings', () => {
  const mockTenant = {
    id: 'test-tenant',
    name: 'Test Tenant',
    instanceName: 'Test Portal',
    slug: 'test-tenant',
    brandTokens: {
      bgPrimary: '#001930',
      bgPanel: '#002e52',
      accent: '#baeb5b',
      textPrimary: '#ffffff',
      textSecondary: '#9dadc8',
      fontDisplay: 'system-ui',
      fontBody: 'system-ui',
      logoAssetId: null,
    },
    customDomain: null,
    status: 'active' as const,
    trialEndsAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without platform session', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');
    formData.set('instanceName', 'New Name');
    formData.set('bgPrimary', '#001930');
    formData.set('bgPanel', '#002e52');
    formData.set('accent', '#baeb5b');
    formData.set('textPrimary', '#ffffff');
    formData.set('textSecondary', '#9dadc8');

    const result = await updateTenantBrandSettings({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not authorized');
  });

  it('requires tenantId', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });

    const formData = new FormData();
    formData.set('instanceName', 'New Name');
    formData.set('bgPrimary', '#001930');
    formData.set('bgPanel', '#002e52');
    formData.set('accent', '#baeb5b');
    formData.set('textPrimary', '#ffffff');
    formData.set('textSecondary', '#9dadc8');

    const result = await updateTenantBrandSettings({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Tenant ID is required');
  });

  it('validates WCAG AA contrast before saving', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });
    vi.mocked(getTenantRepository).mockReturnValue({
      get: vi.fn().mockResolvedValue(mockTenant),
      list: vi.fn(),
      create: vi.fn(),
      setStatus: vi.fn(),
      delete: vi.fn(),
    });

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');
    formData.set('instanceName', 'New Name');
    formData.set('bgPrimary', '#333333');
    formData.set('bgPanel', '#444444');
    formData.set('accent', '#555555');
    formData.set('textPrimary', '#666666'); // Low contrast
    formData.set('textSecondary', '#777777');

    const result = await updateTenantBrandSettings({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('WCAG');
  });

  it('updates tenant brand settings with valid input', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });
    vi.mocked(getTenantRepository).mockReturnValue({
      get: vi.fn().mockResolvedValue(mockTenant),
      list: vi.fn(),
      create: vi.fn(),
      setStatus: vi.fn(),
      delete: vi.fn(),
    });

    const mockUpdate = vi.fn().mockResolvedValue(mockTenant);
    vi.mocked(createTenantRepository).mockReturnValue({
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      setStatus: vi.fn(),
      delete: vi.fn(),
      update: mockUpdate,
    });

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');
    formData.set('instanceName', 'New Portal Name');
    formData.set('bgPrimary', '#001930');
    formData.set('bgPanel', '#002e52');
    formData.set('accent', '#baeb5b');
    formData.set('textPrimary', '#ffffff');
    formData.set('textSecondary', '#9dadc8');

    const result = await updateTenantBrandSettings({ ok: false }, formData);

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith('test-tenant', {
      instanceName: 'New Portal Name',
      brandTokens: expect.objectContaining({
        bgPrimary: '#001930',
        accent: '#baeb5b',
      }),
    });
  });
});

describe('uploadTenantLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without platform session', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');

    const result = await uploadTenantLogo({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not authorized');
  });

  it('requires a logo file', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');

    const result = await uploadTenantLogo({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('No logo file provided');
  });

  it('validates file type', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    formData.set('logo', invalidFile);

    const result = await uploadTenantLogo({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid file type');
  });

  it('validates file size (max 1MB)', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'admin@flowency.co.uk' });

    const formData = new FormData();
    formData.set('tenantId', 'test-tenant');
    // Create a file > 1MB
    const largeContent = new Uint8Array(1.5 * 1024 * 1024);
    const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });
    formData.set('logo', largeFile);

    const result = await uploadTenantLogo({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('File too large');
  });
});

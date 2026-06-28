/**
 * TenantRepository tests
 *
 * Tests the fixture repository and the getTenantRepository() accessor.
 * Per ADR-0012: builds against @bench/types contract with full Tenant fields.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Tenant, TenantRepository } from '@bench/types';
import { CHANGE_CONNECTED_BRAND_TOKENS, DEFAULT_BRAND_TOKENS } from '@bench/types';
import { getTenantRepository, slugify, _resetTenantRepositoryInstance } from '../tenant';

// Reset both the singleton and the globalThis store between tests
const resetInstance = () => {
  // Reset the singleton instance
  _resetTenantRepositoryInstance();
  // Clear the globalThis store to get fresh fixture state
  const g = globalThis as typeof globalThis & {
    __benchTenants__?: unknown;
  };
  delete g.__benchTenants__;
};

describe('slugify', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
    expect(slugify('Change Connected')).toBe('change-connected');
  });

  it('replaces multiple non-alphanumeric chars with single hyphen', () => {
    expect(slugify('Foo   Bar')).toBe('foo-bar');
    expect(slugify('Foo---Bar')).toBe('foo-bar');
    expect(slugify("Foo's Bar & Baz")).toBe('foo-s-bar-baz');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  Acme  ')).toBe('acme');
    expect(slugify('---Acme---')).toBe('acme');
  });

  it('falls back to timestamped id for empty result', () => {
    const result = slugify('   ');
    expect(result).toMatch(/^tenant-\d+$/);
  });
});

describe('TenantRepository (fixture)', () => {
  let repo: TenantRepository;

  beforeEach(() => {
    // Reset module state and singleton
    resetInstance();
    // Force fixture mode by ensuring DATA_BACKEND is not set
    vi.stubEnv('DATA_BACKEND', '');
    vi.stubEnv('BENCH_TABLE_NAME', '');

    // Re-import to get fresh instance - for now use dynamic import workaround
    // Since we can't easily re-import in ESM, we'll just call getTenantRepository
    // which will create a new instance since we cleared the globalThis store
    repo = getTenantRepository();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstance();
  });

  describe('seeded data', () => {
    it('seeds with Change Connected tenant', async () => {
      const tenants = await repo.list();
      const cc = tenants.find((t) => t.id === 'change-connected');

      expect(cc).toBeDefined();
      expect(cc?.name).toBe('Change Connected');
      expect(cc?.instanceName).toBe('Change Hub');
      expect(cc?.status).toBe('active');
    });

    it('seeded tenant has full @bench/types Tenant shape', async () => {
      const cc = await repo.get('change-connected');

      expect(cc).not.toBeNull();
      // Core fields
      expect(cc?.id).toBe('change-connected');
      expect(cc?.name).toBe('Change Connected');
      expect(cc?.slug).toBe('change-connected');
      expect(cc?.instanceName).toBe('Change Hub');
      expect(cc?.status).toBe('active');

      // New required fields from @bench/types
      expect(cc?.brandTokens).toEqual(CHANGE_CONNECTED_BRAND_TOKENS);
      expect(cc?.customDomain).toBeNull();
      expect(cc?.trialEndsAt).toBeNull();
      expect(cc?.createdAt).toBeDefined();
      expect(cc?.updatedAt).toBeDefined();
    });
  });

  describe('list()', () => {
    it('returns all tenants sorted by name', async () => {
      await repo.create({ name: 'Zebra Inc' });
      await repo.create({ name: 'Alpha Ltd' });

      const tenants = await repo.list();

      expect(tenants.length).toBeGreaterThanOrEqual(3);
      // Should be sorted: Alpha, Change Connected, Zebra
      const names = tenants.map((t) => t.name);
      expect(names).toContain('Alpha Ltd');
      expect(names).toContain('Change Connected');
      expect(names).toContain('Zebra Inc');
      expect(names.indexOf('Alpha Ltd')).toBeLessThan(names.indexOf('Change Connected'));
      expect(names.indexOf('Change Connected')).toBeLessThan(names.indexOf('Zebra Inc'));
    });
  });

  describe('get()', () => {
    it('returns tenant by id', async () => {
      const tenant = await repo.get('change-connected');

      expect(tenant).not.toBeNull();
      expect(tenant?.id).toBe('change-connected');
    });

    it('returns null for unknown id', async () => {
      const tenant = await repo.get('unknown-tenant');

      expect(tenant).toBeNull();
    });
  });

  describe('create()', () => {
    it('creates tenant with derived id/slug from name', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.id).toBe('acme-corp');
      expect(tenant.slug).toBe('acme-corp');
      expect(tenant.name).toBe('Acme Corp');
    });

    it('defaults instanceName to name', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.instanceName).toBe('Acme Corp');
    });

    it('uses provided instanceName', async () => {
      const tenant = await repo.create({
        name: 'Acme Corp',
        instanceName: 'Acme Portal',
      });

      expect(tenant.instanceName).toBe('Acme Portal');
    });

    it('sets default brandTokens', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.brandTokens).toEqual(DEFAULT_BRAND_TOKENS);
    });

    it('merges provided brandTokens over defaults', async () => {
      const tenant = await repo.create({
        name: 'Acme Corp',
        brandTokens: { accent: '#ff0000' },
      });

      expect(tenant.brandTokens.accent).toBe('#ff0000');
      expect(tenant.brandTokens.bgPrimary).toBe(DEFAULT_BRAND_TOKENS.bgPrimary);
    });

    it('sets status to active', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.status).toBe('active');
    });

    it('sets timestamps', async () => {
      const before = new Date().toISOString();
      const tenant = await repo.create({ name: 'Acme Corp' });
      const after = new Date().toISOString();

      expect(tenant.createdAt).toBeDefined();
      expect(tenant.updatedAt).toBeDefined();
      expect(tenant.createdAt >= before).toBe(true);
      expect(tenant.createdAt <= after).toBe(true);
    });

    it('sets customDomain to null by default', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.customDomain).toBeNull();
    });

    it('sets trialEndsAt to null by default', async () => {
      const tenant = await repo.create({ name: 'Acme Corp' });

      expect(tenant.trialEndsAt).toBeNull();
    });

    it('persists tenant to store', async () => {
      const created = await repo.create({ name: 'Acme Corp' });
      const retrieved = await repo.get('acme-corp');

      expect(retrieved).toEqual(created);
    });
  });

  describe('setStatus()', () => {
    it('suspends a tenant', async () => {
      const suspended = await repo.setStatus('change-connected', 'suspended');

      expect(suspended.status).toBe('suspended');
    });

    it('reactivates a suspended tenant', async () => {
      await repo.setStatus('change-connected', 'suspended');
      const reactivated = await repo.setStatus('change-connected', 'active');

      expect(reactivated.status).toBe('active');
    });

    it('updates updatedAt timestamp', async () => {
      const before = await repo.get('change-connected');
      const beforeUpdatedAt = before?.updatedAt;

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10));

      const updated = await repo.setStatus('change-connected', 'suspended');

      expect(updated.updatedAt).not.toBe(beforeUpdatedAt);
    });

    it('throws for unknown tenant', async () => {
      await expect(repo.setStatus('unknown', 'suspended')).rejects.toThrow(
        'Tenant unknown not found',
      );
    });
  });

  describe('delete()', () => {
    it('removes tenant from store', async () => {
      await repo.create({ name: 'Temp Tenant' });
      expect(await repo.get('temp-tenant')).not.toBeNull();

      await repo.delete('temp-tenant');

      expect(await repo.get('temp-tenant')).toBeNull();
    });

    it('does not throw for unknown tenant', async () => {
      // delete is idempotent
      await expect(repo.delete('unknown-tenant')).resolves.not.toThrow();
    });
  });
});

describe('getTenantRepository() accessor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstance();
  });

  it('returns fixture by default (no DATA_BACKEND)', () => {
    resetInstance();
    vi.stubEnv('DATA_BACKEND', '');

    const repo = getTenantRepository();

    expect(repo).toBeDefined();
    expect(repo.list).toBeInstanceOf(Function);
  });

  it('throws when DATA_BACKEND=dynamodb but no BENCH_TABLE_NAME', () => {
    resetInstance();
    vi.stubEnv('DATA_BACKEND', 'dynamodb');
    vi.stubEnv('BENCH_TABLE_NAME', '');

    expect(() => getTenantRepository()).toThrow('BENCH_TABLE_NAME is required');
  });
});

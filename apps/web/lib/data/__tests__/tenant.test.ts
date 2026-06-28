/**
 * TenantRepository accessor tests
 *
 * Note: The CTO simplified tenant.ts to always use DynamoDB (no fixture mode).
 * Full DynamoDB integration tests are in @bench/data package.
 * These tests verify only the interface contract and singleton behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getTenantRepository, slugify, _resetTenantRepositoryInstance } from '../tenant';

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

describe('getTenantRepository() accessor', () => {
  beforeEach(() => {
    _resetTenantRepositoryInstance();
  });

  it('returns a TenantRepository instance with expected methods', () => {
    const repo = getTenantRepository();
    expect(repo).toBeDefined();
    expect(typeof repo.list).toBe('function');
    expect(typeof repo.get).toBe('function');
    expect(typeof repo.create).toBe('function');
    expect(typeof repo.setStatus).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const repo1 = getTenantRepository();
    const repo2 = getTenantRepository();
    expect(repo1).toBe(repo2);
  });

  it('returns a fresh instance after reset', () => {
    const repo1 = getTenantRepository();
    _resetTenantRepositoryInstance();
    const repo2 = getTenantRepository();
    expect(repo1).not.toBe(repo2);
  });
});

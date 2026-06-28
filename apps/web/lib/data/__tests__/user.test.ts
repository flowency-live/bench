/**
 * UserRepository accessor tests
 *
 * Note: The CTO simplified user.ts to always use DynamoDB (no fixture mode).
 * Full DynamoDB integration tests are in @bench/data package.
 * These tests verify only the interface contract and singleton behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getUserRepository, _resetUserRepositoryInstance } from '../user';

describe('getUserRepository() accessor', () => {
  beforeEach(() => {
    _resetUserRepositoryInstance();
  });

  it('returns a UserRepository instance with expected methods', () => {
    const repo = getUserRepository();
    expect(repo).toBeDefined();
    expect(typeof repo.create).toBe('function');
    expect(typeof repo.getByEmail).toBe('function');
    expect(typeof repo.listByTenant).toBe('function');
    expect(typeof repo.setRole).toBe('function');
    expect(typeof repo.setStatus).toBe('function');
    expect(typeof repo.bindIdentity).toBe('function');
    expect(typeof repo.remove).toBe('function');
    expect(typeof repo.removeByTenant).toBe('function');
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const repo1 = getUserRepository();
    const repo2 = getUserRepository();
    expect(repo1).toBe(repo2);
  });

  it('returns a fresh instance after reset', () => {
    const repo1 = getUserRepository();
    _resetUserRepositoryInstance();
    const repo2 = getUserRepository();
    expect(repo1).not.toBe(repo2);
  });
});

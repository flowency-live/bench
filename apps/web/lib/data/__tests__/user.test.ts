/**
 * UserRepository tests
 *
 * Tests the fixture repository and the getUserRepository() accessor.
 * Per ADR-0012: builds against @bench/types contract with cognitoId + bindIdentity.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TenantUser, UserRepository } from '@bench/types';
import { getUserRepository, _resetUserRepositoryInstance } from '../user';

// Reset both the singleton and the globalThis store between tests
const resetInstance = () => {
  _resetUserRepositoryInstance();
  const g = globalThis as typeof globalThis & {
    __benchUsers__?: unknown;
  };
  delete g.__benchUsers__;
};

describe('UserRepository (fixture)', () => {
  let repo: UserRepository;

  beforeEach(() => {
    resetInstance();
    vi.stubEnv('DATA_BACKEND', '');
    vi.stubEnv('BENCH_TABLE_NAME', '');
    repo = getUserRepository();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstance();
  });

  describe('seeded data', () => {
    it('seeds with Oliver as active admin of Change Connected', async () => {
      const users = await repo.listByTenant('change-connected');
      const oliver = users.find((u) => u.email === 'oliver@changeconnected.co.uk');

      expect(oliver).toBeDefined();
      expect(oliver?.name).toBe('Oliver Bradley');
      expect(oliver?.role).toBe('admin');
      expect(oliver?.status).toBe('active');
      expect(oliver?.tenantId).toBe('change-connected');
    });

    it('seeded user has full @bench/types TenantUser shape', async () => {
      const oliver = await repo.getByEmail('oliver@changeconnected.co.uk');

      expect(oliver).not.toBeNull();
      expect(oliver?.id).toBe('oliver-bradley');
      expect(oliver?.tenantId).toBe('change-connected');
      expect(oliver?.email).toBe('oliver@changeconnected.co.uk');
      expect(oliver?.name).toBe('Oliver Bradley');
      expect(oliver?.role).toBe('admin');
      expect(oliver?.status).toBe('active');
      expect(oliver?.createdAt).toBeDefined();
      // New field from @bench/types (ADR-0012)
      expect(oliver?.cognitoId).toBeNull();
    });
  });

  describe('create()', () => {
    it('creates user with pending status', async () => {
      const user = await repo.create('change-connected', {
        email: 'alice@example.com',
        role: 'viewer',
        name: 'Alice',
      });

      expect(user.email).toBe('alice@example.com');
      expect(user.role).toBe('viewer');
      expect(user.status).toBe('pending');
      expect(user.tenantId).toBe('change-connected');
    });

    it('normalizes email to lowercase', async () => {
      const user = await repo.create('change-connected', {
        email: 'ALICE@Example.COM',
        role: 'viewer',
      });

      expect(user.email).toBe('alice@example.com');
    });

    it('sets cognitoId to null for new users', async () => {
      const user = await repo.create('change-connected', {
        email: 'alice@example.com',
        role: 'viewer',
      });

      expect(user.cognitoId).toBeNull();
    });

    it('sets invitedBy when provided', async () => {
      const user = await repo.create('change-connected', {
        email: 'alice@example.com',
        role: 'viewer',
        invitedBy: 'oliver@changeconnected.co.uk',
      });

      expect(user.invitedBy).toBe('oliver@changeconnected.co.uk');
    });

    it('generates unique id', async () => {
      const user1 = await repo.create('change-connected', {
        email: 'user1@example.com',
        role: 'viewer',
      });
      const user2 = await repo.create('change-connected', {
        email: 'user2@example.com',
        role: 'viewer',
      });

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('getByEmail()', () => {
    it('returns user by email (global lookup)', async () => {
      const user = await repo.getByEmail('oliver@changeconnected.co.uk');

      expect(user).not.toBeNull();
      expect(user?.email).toBe('oliver@changeconnected.co.uk');
    });

    it('is case-insensitive', async () => {
      const user = await repo.getByEmail('OLIVER@CHANGECONNECTED.CO.UK');

      expect(user).not.toBeNull();
      expect(user?.email).toBe('oliver@changeconnected.co.uk');
    });

    it('returns null for unknown email', async () => {
      const user = await repo.getByEmail('unknown@example.com');

      expect(user).toBeNull();
    });
  });

  describe('listByTenant()', () => {
    it('returns only users of the specified tenant', async () => {
      // Create user in different tenant
      await repo.create('other-tenant', {
        email: 'other@example.com',
        role: 'admin',
      });

      const ccUsers = await repo.listByTenant('change-connected');

      expect(ccUsers.every((u) => u.tenantId === 'change-connected')).toBe(true);
      expect(ccUsers.find((u) => u.email === 'other@example.com')).toBeUndefined();
    });

    it('returns users sorted by email', async () => {
      await repo.create('change-connected', { email: 'zebra@example.com', role: 'viewer' });
      await repo.create('change-connected', { email: 'alice@example.com', role: 'viewer' });

      const users = await repo.listByTenant('change-connected');
      const emails = users.map((u) => u.email);

      expect(emails.indexOf('alice@example.com')).toBeLessThan(
        emails.indexOf('oliver@changeconnected.co.uk'),
      );
      expect(emails.indexOf('oliver@changeconnected.co.uk')).toBeLessThan(
        emails.indexOf('zebra@example.com'),
      );
    });

    it('returns empty array for tenant with no users', async () => {
      const users = await repo.listByTenant('empty-tenant');

      expect(users).toEqual([]);
    });
  });

  describe('setRole()', () => {
    it('changes user role', async () => {
      const updated = await repo.setRole('change-connected', 'oliver-bradley', 'viewer');

      expect(updated.role).toBe('viewer');
    });

    it('throws for user not in tenant', async () => {
      await expect(repo.setRole('other-tenant', 'oliver-bradley', 'viewer')).rejects.toThrow(
        'User oliver-bradley not found in tenant other-tenant',
      );
    });

    it('throws for unknown user', async () => {
      await expect(repo.setRole('change-connected', 'unknown', 'viewer')).rejects.toThrow(
        'User unknown not found',
      );
    });
  });

  describe('setStatus()', () => {
    it('changes user status', async () => {
      const user = await repo.create('change-connected', {
        email: 'pending@example.com',
        role: 'viewer',
      });

      const activated = await repo.setStatus('change-connected', user.id, 'active');

      expect(activated.status).toBe('active');
    });

    it('throws for user not in tenant', async () => {
      await expect(repo.setStatus('other-tenant', 'oliver-bradley', 'pending')).rejects.toThrow(
        'User oliver-bradley not found in tenant other-tenant',
      );
    });
  });

  describe('bindIdentity()', () => {
    it('sets cognitoId and activates user (ADR-0012)', async () => {
      // Create a pending user
      const pending = await repo.create('change-connected', {
        email: 'newuser@example.com',
        role: 'admin',
      });
      expect(pending.status).toBe('pending');
      expect(pending.cognitoId).toBeNull();

      // Bind identity
      const bound = await repo.bindIdentity(
        'change-connected',
        pending.id,
        'cognito-sub-123',
      );

      expect(bound.cognitoId).toBe('cognito-sub-123');
      expect(bound.status).toBe('active');
    });

    it('throws for user not in tenant', async () => {
      await expect(
        repo.bindIdentity('other-tenant', 'oliver-bradley', 'cognito-sub-123'),
      ).rejects.toThrow('User oliver-bradley not found in tenant other-tenant');
    });
  });

  describe('remove()', () => {
    it('removes user from store', async () => {
      const user = await repo.create('change-connected', {
        email: 'todelete@example.com',
        role: 'viewer',
      });

      await repo.remove('change-connected', user.id);

      expect(await repo.getByEmail('todelete@example.com')).toBeNull();
    });

    it('throws for user not in tenant', async () => {
      await expect(repo.remove('other-tenant', 'oliver-bradley')).rejects.toThrow(
        'User oliver-bradley not found in tenant other-tenant',
      );
    });

    it('refuses to remove last active admin', async () => {
      // Oliver is the only active admin
      await expect(repo.remove('change-connected', 'oliver-bradley')).rejects.toThrow(
        'Cannot remove the last active admin of a tenant',
      );
    });

    it('allows removing admin if another active admin exists', async () => {
      // Create another active admin
      const admin2 = await repo.create('change-connected', {
        email: 'admin2@example.com',
        role: 'admin',
      });
      await repo.setStatus('change-connected', admin2.id, 'active');

      // Now Oliver can be removed
      await expect(repo.remove('change-connected', 'oliver-bradley')).resolves.not.toThrow();
    });

    it('allows removing pending admin (not counted as active)', async () => {
      const pendingAdmin = await repo.create('change-connected', {
        email: 'pending-admin@example.com',
        role: 'admin',
      });
      // pendingAdmin has status='pending', so removing is OK

      await expect(repo.remove('change-connected', pendingAdmin.id)).resolves.not.toThrow();
    });
  });

  describe('removeByTenant()', () => {
    it('removes all users of a tenant', async () => {
      await repo.create('change-connected', { email: 'user1@example.com', role: 'viewer' });
      await repo.create('change-connected', { email: 'user2@example.com', role: 'viewer' });

      await repo.removeByTenant('change-connected');

      const remaining = await repo.listByTenant('change-connected');
      expect(remaining).toEqual([]);
    });

    it('does not remove users from other tenants', async () => {
      await repo.create('other-tenant', { email: 'other@example.com', role: 'admin' });

      await repo.removeByTenant('change-connected');

      const other = await repo.getByEmail('other@example.com');
      expect(other).not.toBeNull();
    });

    it('has no last-admin guard (cascade delete)', async () => {
      // removeByTenant is for cascade delete, no guard
      await expect(repo.removeByTenant('change-connected')).resolves.not.toThrow();

      const remaining = await repo.listByTenant('change-connected');
      expect(remaining).toEqual([]);
    });
  });
});

describe('getUserRepository() accessor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstance();
  });

  it('returns fixture by default (no DATA_BACKEND)', () => {
    resetInstance();
    vi.stubEnv('DATA_BACKEND', '');

    const repo = getUserRepository();

    expect(repo).toBeDefined();
    expect(repo.getByEmail).toBeInstanceOf(Function);
    expect(repo.listByTenant).toBeInstanceOf(Function);
  });

  it('throws when DATA_BACKEND=dynamodb but no BENCH_TABLE_NAME', () => {
    resetInstance();
    vi.stubEnv('DATA_BACKEND', 'dynamodb');
    vi.stubEnv('BENCH_TABLE_NAME', '');

    expect(() => getUserRepository()).toThrow('BENCH_TABLE_NAME is required');
  });
});

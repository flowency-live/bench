/**
 * UserRepository accessor for the control plane (ADR-0010, ADR-0012).
 *
 * A `TenantUser` belongs to exactly one tenant and carries a role. Login resolves
 * a user globally by email (the GSI1 `EMAIL#{email}` lookup in DynamoDB) to
 * recover their tenant + role; within a tenant, admins list/manage users.
 *
 * Mirrors `getRepository()` env-gating: a zero-dependency in-memory fixture by
 * default, or the real `@bench/data` `UserRepository` when DATA_BACKEND=dynamodb.
 */

import type {
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
  CreateTenantUserInput,
  UserRepository,
} from '@bench/types';
import { createUserRepository as createDynamoUserRepo, createClient } from '@bench/data';

// Re-export types from @bench/types for consumers that previously imported from here
export type {
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
  CreateTenantUserInput,
  UserRepository,
};

let instance: UserRepository | null = null;

/**
 * Reset the singleton instance (for testing only).
 * @internal
 */
export function _resetUserRepositoryInstance(): void {
  instance = null;
}

/**
 * Resolve the active user repository.
 *
 * - DATA_BACKEND=dynamodb -> the real DynamoDB layer (ADR-0008/0010). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise -> an in-memory fixture on `globalThis`, so the control plane runs
 *   locally with no AWS.
 */
export function getUserRepository(): UserRepository {
  if (instance) return instance;

  if (process.env.DATA_BACKEND === 'dynamodb') {
    const tableName = process.env.BENCH_TABLE_NAME;
    if (!tableName) {
      throw new Error('BENCH_TABLE_NAME is required when DATA_BACKEND=dynamodb');
    }
    instance = createDynamoUserRepository(tableName, process.env.AWS_REGION);
  } else {
    instance = createFixtureUserRepository();
  }

  return instance;
}

/**
 * DynamoDB-backed user repository - wired to `@bench/data`.
 */
function createDynamoUserRepository(
  tableName: string,
  region: string | undefined,
): UserRepository {
  const client = createClient({ region: region ?? 'eu-west-2' });
  return createDynamoUserRepo(client, tableName);
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * In-memory fixture store on `globalThis` (survives dev hot-reloads). Seeded
 * with Oliver as an active admin of the Change Connected tenant so the existing
 * pilot admin resolves by email from first load.
 */
interface FixtureStore {
  byId: Map<string, TenantUser>;
}

function fixtureStore(): FixtureStore {
  const g = globalThis as typeof globalThis & {
    __benchUsers__?: FixtureStore;
  };
  if (!g.__benchUsers__) {
    const byId = new Map<string, TenantUser>();
    const seeded: TenantUser = {
      id: 'oliver-bradley',
      tenantId: 'change-connected',
      email: 'oliver@changeconnected.co.uk',
      name: 'Oliver Bradley',
      role: 'admin',
      status: 'active',
      cognitoId: null, // ADR-0012: null until identity is bound
      createdAt: '2026-06-20T09:00:00.000Z',
    };
    byId.set(seeded.id, seeded);
    g.__benchUsers__ = { byId };
  }
  return g.__benchUsers__;
}

function createFixtureUserRepository(): UserRepository {
  return {
    async create(tenantId, input) {
      const store = fixtureStore();
      const user: TenantUser = {
        id: uid(),
        tenantId,
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim() || undefined,
        role: input.role,
        status: 'pending',
        cognitoId: null, // ADR-0012: null until identity is bound
        invitedBy: input.invitedBy?.trim().toLowerCase() || undefined,
        createdAt: new Date().toISOString(),
      };
      store.byId.set(user.id, user);
      return user;
    },
    async getByEmail(email) {
      const normalized = email.trim().toLowerCase();
      for (const user of fixtureStore().byId.values()) {
        if (user.email === normalized) return user;
      }
      return null;
    },
    async listByTenant(tenantId) {
      return Array.from(fixtureStore().byId.values())
        .filter((u) => u.tenantId === tenantId)
        .sort((a, b) => a.email.localeCompare(b.email));
    },
    async setRole(tenantId, userId, role) {
      const store = fixtureStore();
      const user = store.byId.get(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error(`User ${userId} not found in tenant ${tenantId}`);
      }
      const updated: TenantUser = { ...user, role };
      store.byId.set(userId, updated);
      return updated;
    },
    async setStatus(tenantId, userId, status) {
      const store = fixtureStore();
      const user = store.byId.get(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error(`User ${userId} not found in tenant ${tenantId}`);
      }
      const updated: TenantUser = { ...user, status };
      store.byId.set(userId, updated);
      return updated;
    },
    async bindIdentity(tenantId, userId, cognitoId) {
      const store = fixtureStore();
      const user = store.byId.get(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error(`User ${userId} not found in tenant ${tenantId}`);
      }
      // ADR-0012: Bind Cognito identity and activate user
      const updated: TenantUser = { ...user, cognitoId, status: 'active' };
      store.byId.set(userId, updated);
      return updated;
    },
    async remove(tenantId, userId) {
      const store = fixtureStore();
      const user = store.byId.get(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error(`User ${userId} not found in tenant ${tenantId}`);
      }
      if (user.role === 'admin' && user.status === 'active') {
        const activeAdmins = Array.from(store.byId.values()).filter(
          (u) =>
            u.tenantId === tenantId && u.status === 'active' && u.role === 'admin',
        );
        if (activeAdmins.length <= 1) {
          throw new Error('Cannot remove the last active admin of a tenant.');
        }
      }
      store.byId.delete(userId);
    },
    async removeByTenant(tenantId) {
      const store = fixtureStore();
      for (const [id, user] of store.byId) {
        if (user.tenantId === tenantId) {
          store.byId.delete(id);
        }
      }
    },
  };
}

/**
 * UserRepository accessor for the control plane (ADR-0010).
 *
 * A `TenantUser` belongs to exactly one tenant and carries a role. Login resolves
 * a user globally by email (the GSI1 `EMAIL#{email}` lookup in DynamoDB) to
 * recover their tenant + role; within a tenant, admins list/manage users.
 *
 * Mirrors `getRepository()` env-gating: a zero-dependency in-memory fixture by
 * default, or the real `@bench/data` `UserRepository` when DATA_BACKEND=dynamodb.
 * The DynamoDB branch is a clearly-marked stub — the VS agent owns it.
 */

export type TenantUserRole = 'admin' | 'viewer';
export type TenantUserStatus = 'pending' | 'active';

/** A portal user scoped to a single tenant. */
export interface TenantUser {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly name?: string;
  readonly role: TenantUserRole;
  readonly status: TenantUserStatus;
  readonly invitedBy?: string;
  readonly createdAt: string;
}

/** Input for creating a tenant user (tenant supplied separately). */
export interface CreateTenantUserInput {
  readonly email: string;
  readonly role: TenantUserRole;
  readonly name?: string;
  readonly invitedBy?: string;
}

/** The slice of the user contract the control plane needs. */
export interface UserRepository {
  create(tenantId: string, input: CreateTenantUserInput): Promise<TenantUser>;
  /** Global lookup across all tenants (DynamoDB GSI1 `EMAIL#{email}`). */
  getByEmail(email: string): Promise<TenantUser | null>;
  listByTenant(tenantId: string): Promise<TenantUser[]>;
  setRole(tenantId: string, userId: string, role: TenantUserRole): Promise<TenantUser>;
  setStatus(tenantId: string, userId: string, status: TenantUserStatus): Promise<TenantUser>;
}

let instance: UserRepository | null = null;

/**
 * Resolve the active user repository.
 *
 * - DATA_BACKEND=dynamodb → the real DynamoDB layer (ADR-0008/0010). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise → an in-memory fixture on `globalThis`, so the control plane runs
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
 * DynamoDB-backed user repository — thin adapter over `@bench/data`.
 *
 * TODO(@bench/data): UserRepository — the real `createUserRepository` (with the
 * GSI1 `EMAIL#{email}` global index) does not exist yet. This is the VS agent's
 * job (ADR-0010 §Build split → AGENT). When it lands it should expose
 * `create`/`getByEmail`/`listByTenant`/`setRole`/`setStatus` in the shapes above;
 * wire it here exactly like `dynamo-repository.ts`.
 */
function createDynamoUserRepository(
  tableName: string,
  region: string | undefined,
): UserRepository {
  void tableName;
  void region;
  throw new Error(
    'UserRepository (DynamoDB) is not implemented yet — TODO(@bench/data). ' +
      'Run with DATA_BACKEND unset to use the local fixture.',
  );
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
  };
}

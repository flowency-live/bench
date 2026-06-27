/**
 * TenantRepository accessor for the godmode control plane (ADR-0010).
 *
 * Mirrors `getRepository()` env-gating: a zero-dependency in-memory fixture by
 * default (so godmode runs locally with no AWS), or the real `@bench/data`
 * DynamoDB `TenantRepository` when `DATA_BACKEND=dynamodb`.
 *
 * The real DynamoDB `TenantRepository` is the VS agent's job — the dynamodb
 * branch here is a clearly-marked stub. See `// TODO(@bench/data)` below.
 */

import { PILOT_TENANT } from '@/lib/tenant';

export type TenantStatus = 'active' | 'suspended';

/** A tenant (a customer organisation) in the control plane. */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly instanceName: string;
  readonly status: TenantStatus;
  readonly createdAt: string;
}

/** Input for creating a tenant — id/slug/status are derived. */
export interface CreateTenantInput {
  readonly name: string;
  readonly instanceName?: string;
}

/** The slice of the tenant contract godmode needs. */
export interface TenantRepository {
  list(): Promise<Tenant[]>;
  get(id: string): Promise<Tenant | null>;
  create(input: CreateTenantInput): Promise<Tenant>;
}

/**
 * Slugify a company name → a stable, URL-safe id.
 * Lowercase, non-alphanumerics → single hyphen, trimmed of leading/trailing
 * hyphens. Empty results fall back to a timestamped id so create never fails.
 */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `tenant-${Date.now()}`;
}

let instance: TenantRepository | null = null;

/**
 * Resolve the active tenant repository.
 *
 * - DATA_BACKEND=dynamodb → the real DynamoDB layer (ADR-0008/0010). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise → an in-memory fixture on `globalThis`, so godmode runs locally
 *   with no AWS.
 */
export function getTenantRepository(): TenantRepository {
  if (instance) return instance;

  if (process.env.DATA_BACKEND === 'dynamodb') {
    const tableName = process.env.BENCH_TABLE_NAME;
    if (!tableName) {
      throw new Error('BENCH_TABLE_NAME is required when DATA_BACKEND=dynamodb');
    }
    instance = createDynamoTenantRepository(tableName, process.env.AWS_REGION);
  } else {
    instance = createFixtureTenantRepository();
  }

  return instance;
}

/**
 * DynamoDB-backed tenant repository — thin adapter over `@bench/data`.
 *
 * TODO(@bench/data): TenantRepository — the real `createTenantRepository` does
 * not exist yet. This is the VS agent's job (ADR-0010 §Build split → AGENT).
 * When it lands it should expose `list`/`get`/`create` in the shapes above
 * (PK/SK `TENANT#{id}`); wire it here exactly like `dynamo-repository.ts`.
 */
function createDynamoTenantRepository(
  tableName: string,
  region: string | undefined,
): TenantRepository {
  void tableName;
  void region;
  throw new Error(
    'TenantRepository (DynamoDB) is not implemented yet — TODO(@bench/data). ' +
      'Run godmode with DATA_BACKEND unset to use the local fixture.',
  );
}

/**
 * In-memory fixture store, kept on `globalThis` so it survives the per-request
 * module re-evaluation in Next dev. Seeded with the Change Connected tenant so
 * the existing pilot tenant is visible in godmode from first load.
 */
interface FixtureStore {
  byId: Map<string, Tenant>;
}

function fixtureStore(): FixtureStore {
  const g = globalThis as typeof globalThis & {
    __benchTenants__?: FixtureStore;
  };
  if (!g.__benchTenants__) {
    const byId = new Map<string, Tenant>();
    const seeded: Tenant = {
      id: PILOT_TENANT.id,
      name: PILOT_TENANT.name,
      slug: PILOT_TENANT.id,
      instanceName: PILOT_TENANT.instanceName,
      status: 'active',
      createdAt: '2026-06-20T09:00:00.000Z',
    };
    byId.set(seeded.id, seeded);
    g.__benchTenants__ = { byId };
  }
  return g.__benchTenants__;
}

function createFixtureTenantRepository(): TenantRepository {
  return {
    async list() {
      return Array.from(fixtureStore().byId.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    },
    async get(id) {
      return fixtureStore().byId.get(id) ?? null;
    },
    async create(input) {
      const store = fixtureStore();
      const id = slugify(input.name);
      const tenant: Tenant = {
        id,
        name: input.name.trim(),
        slug: id,
        instanceName: input.instanceName?.trim() || input.name.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      store.byId.set(id, tenant);
      return tenant;
    },
  };
}

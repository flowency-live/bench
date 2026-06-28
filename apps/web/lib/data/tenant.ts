/**
 * TenantRepository accessor for the godmode control plane (ADR-0010).
 *
 * Mirrors `getRepository()` env-gating: a zero-dependency in-memory fixture by
 * default (so godmode runs locally with no AWS), or the real `@bench/data`
 * DynamoDB `TenantRepository` when `DATA_BACKEND=dynamodb`.
 */

import type {
  Tenant,
  TenantStatus,
  BrandTokens,
  TenantRepository,
  CreateTenantInput,
} from '@bench/types';
import {
  DEFAULT_BRAND_TOKENS,
  CHANGE_CONNECTED_BRAND_TOKENS,
} from '@bench/types';
import { createTenantRepository as createDynamoTenantRepo, createClient } from '@bench/data';
import { PILOT_TENANT } from '@/lib/tenant';

// Re-export types from @bench/types for consumers that previously imported from here
export type { Tenant, TenantStatus, BrandTokens, TenantRepository, CreateTenantInput };

/**
 * Slugify a company name -> a stable, URL-safe id.
 * Lowercase, non-alphanumerics -> single hyphen, trimmed of leading/trailing
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
 * Reset the singleton instance (for testing only).
 * @internal
 */
export function _resetTenantRepositoryInstance(): void {
  instance = null;
}

/**
 * Resolve the active tenant repository.
 *
 * - DATA_BACKEND=dynamodb -> the real DynamoDB layer (ADR-0008/0010). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise -> an in-memory fixture on `globalThis`, so godmode runs locally
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
 * DynamoDB-backed tenant repository - wired to `@bench/data`.
 */
function createDynamoTenantRepository(
  tableName: string,
  region: string | undefined,
): TenantRepository {
  const client = createClient({ region: region ?? 'eu-west-2' });
  return createDynamoTenantRepo(client, tableName);
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
    const now = '2026-06-20T09:00:00.000Z';
    const seeded: Tenant = {
      id: PILOT_TENANT.id,
      name: PILOT_TENANT.name,
      slug: PILOT_TENANT.id,
      instanceName: PILOT_TENANT.instanceName,
      brandTokens: CHANGE_CONNECTED_BRAND_TOKENS,
      customDomain: null,
      status: 'active',
      trialEndsAt: null,
      createdAt: now,
      updatedAt: now,
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
      const now = new Date().toISOString();

      // Merge provided brandTokens over defaults
      const brandTokens: BrandTokens = input.brandTokens
        ? { ...DEFAULT_BRAND_TOKENS, ...input.brandTokens }
        : DEFAULT_BRAND_TOKENS;

      const tenant: Tenant = {
        id,
        name: input.name.trim(),
        slug: id,
        instanceName: input.instanceName?.trim() || input.name.trim(),
        brandTokens,
        customDomain: input.customDomain ?? null,
        status: 'active',
        trialEndsAt: null,
        createdAt: now,
        updatedAt: now,
      };
      store.byId.set(id, tenant);
      return tenant;
    },
    async setStatus(id, status) {
      const store = fixtureStore();
      const tenant = store.byId.get(id);
      if (!tenant) {
        throw new Error(`Tenant ${id} not found`);
      }
      const updated: Tenant = {
        ...tenant,
        status,
        updatedAt: new Date().toISOString(),
      };
      store.byId.set(id, updated);
      return updated;
    },
    async delete(id) {
      // TODO(@bench/data): cascade-purge all items under TENANT#{id} (profiles,
      // users, magic links); production should SOFT-delete with a retention
      // window, not hard-purge.
      fixtureStore().byId.delete(id);
    },
  };
}

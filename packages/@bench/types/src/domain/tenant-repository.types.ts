/**
 * TenantRepository — the canonical control-plane data-access contract (ADR-0010).
 *
 * Published here so `@bench/data` (implementation) and `apps/web` (godmode
 * consumer) share ONE contract. Unlike `ProfileRepository`, tenant listing is a
 * PLATFORM operation: `list()` takes no tenantId and returns every tenant
 * (godmode is cross-tenant). All items live under `TENANT#{id}` (ADR-0008).
 */
import type {
  BrandTokens,
  Tenant,
  TenantStatus,
} from './tenant.types';

/**
 * Input for creating a tenant. The repository derives `id`/`slug` from `name`
 * (lowercase, non-alphanumerics → single hyphen, trimmed), sets `status:'active'`,
 * stamps `createdAt`/`updatedAt`, and fills `brandTokens` by merging any provided
 * partial over the platform `DEFAULT_BRAND_TOKENS`. `instanceName` defaults to `name`.
 */
export interface CreateTenantInput {
  readonly name: string;
  readonly instanceName?: string;
  readonly brandTokens?: Partial<BrandTokens>;
  readonly customDomain?: string | null;
}

export interface TenantRepository {
  /** Every tenant in the platform (godmode list). Cross-tenant by design. */
  list(): Promise<readonly Tenant[]>;
  /** A single tenant, or null. */
  get(id: string): Promise<Tenant | null>;
  /** Create a tenant; id/slug/timestamps/brand defaults are derived (see input). */
  create(input: CreateTenantInput): Promise<Tenant>;
  /** Suspend ('suspended') or reactivate ('active') a tenant; stamps `updatedAt`. */
  setStatus(id: string, status: TenantStatus): Promise<Tenant>;
  /**
   * Remove a tenant and cascade-purge every item under `TENANT#{id}` (profiles,
   * users, magic links). NOTE: production should soft-delete with a retention
   * window rather than hard-purge (BACKLOG CP5) — that is a later refinement.
   */
  delete(id: string): Promise<void>;
}

/**
 * UserRepository — the canonical control-plane user data-access contract
 * (ADR-0010, ADR-0012).
 *
 * Published here so `@bench/data` (implementation) and `apps/web` (consumer)
 * share ONE contract. `getByEmail` is the global login lookup, resolved via the
 * DynamoDB GSI1 `EMAIL#{email}` index (the one cross-tenant read); every other
 * method is tenant-scoped (tenantId first).
 */
import type {
  CreateTenantUserInput,
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
} from './user.types';

export interface UserRepository {
  /** Create a tenant user (status starts `pending`). */
  create(tenantId: string, input: CreateTenantUserInput): Promise<TenantUser>;
  /**
   * Global lookup across all tenants by email (DynamoDB GSI1 `EMAIL#{email}`).
   * This is how login recovers a user's tenant + role from their email alone.
   */
  getByEmail(email: string): Promise<TenantUser | null>;
  /** All users of one tenant (admin user-management list). */
  listByTenant(tenantId: string): Promise<readonly TenantUser[]>;
  /** Change a user's role within their tenant. */
  setRole(tenantId: string, userId: string, role: TenantUserRole): Promise<TenantUser>;
  /** Change a user's lifecycle status (e.g. `pending` → `active` on claim). */
  setStatus(tenantId: string, userId: string, status: TenantUserStatus): Promise<TenantUser>;
  /**
   * Bind a Cognito identity to a claimed user and activate them (ADR-0012).
   * Called from the auth callback once Cognito has verified the principal:
   * sets `cognitoId` and moves `status` → `active`.
   */
  bindIdentity(tenantId: string, userId: string, cognitoId: string): Promise<TenantUser>;
  /**
   * Remove a single user from a tenant. MUST refuse to remove the last active
   * admin of a tenant (so a tenant is never left without an admin).
   */
  remove(tenantId: string, userId: string): Promise<void>;
  /** Remove all users of a tenant (tenant-delete cascade; no last-admin guard). */
  removeByTenant(tenantId: string): Promise<void>;
}

/**
 * UserRepository accessor for the control plane (ADR-0010, ADR-0012).
 *
 * A `TenantUser` belongs to exactly one tenant and carries a role. Login resolves
 * a user globally by email (the GSI1 `EMAIL#{email}` lookup in DynamoDB) to
 * recover their tenant + role; within a tenant, admins list/manage users.
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
 * Get the DynamoDB user repository.
 */
export function getUserRepository(): UserRepository {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  instance = createDynamoUserRepo(client, tableName);

  return instance;
}

/**
 * TenantRepository accessor for the godmode control plane (ADR-0010).
 * DynamoDB single-table design.
 */

import type {
  Tenant,
  TenantStatus,
  BrandTokens,
  TenantRepository,
  CreateTenantInput,
} from '@bench/types';
import { createTenantRepository as createDynamoTenantRepo, createClient } from '@bench/data';

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
 * Get the DynamoDB tenant repository.
 */
export function getTenantRepository(): TenantRepository {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const client = createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  instance = createDynamoTenantRepo(client, tableName);

  return instance;
}

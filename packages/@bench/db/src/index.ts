/**
 * @bench/db - Database layer for Bench
 *
 * Provides:
 * - Migrations for Aurora Serverless v2 (Postgres) schema
 * - RLS policies for multi-tenant isolation
 * - Repository layer for tenant-scoped data access
 *
 * Two-phase migration model:
 * - Bootstrap (as master): extensions, roles, default privileges
 * - Schema (as bench_ddl): tables, RLS, functions
 */
export {
  applyMigrations,
  applyBootstrapMigrations,
  applySchemaMigrations,
  rollbackMigration,
  migrations,
} from './migrations/index.js';

export { createTenantContext, type TenantContext } from './repository/tenant-context.js';
export { createProfileRepository, type ProfileRepository } from './repository/profile-repository.js';
export { createMagicLinkRepository, type MagicLinkRepository } from './repository/magic-link-repository.js';

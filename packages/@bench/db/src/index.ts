/**
 * @bench/db - Database layer for Bench
 *
 * Provides:
 * - Migrations for Aurora Serverless v2 (Postgres) schema
 * - RLS policies for multi-tenant isolation
 * - Kysely-based type-safe query builder (planned for item 5)
 */
export { applyMigrations, rollbackMigration, migrations } from './migrations/index.js';

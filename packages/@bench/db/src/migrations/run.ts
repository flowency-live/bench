#!/usr/bin/env tsx
/**
 * Migration runner CLI
 *
 * Two-phase migration model for Aurora:
 *
 * Phase 1 - Bootstrap (as master/rds_superuser):
 *   DATABASE_URL=postgres://master:xxx@host/db pnpm migrate --bootstrap
 *
 * Phase 2 - Schema (as bench_ddl):
 *   DATABASE_URL=postgres://bench_ddl:xxx@host/db pnpm migrate --schema
 *
 * Or run all migrations with the appropriate roles:
 *   pnpm migrate                    # All migrations (use role matching the phase)
 *   pnpm migrate --rollback         # Roll back most recent
 *
 * Environment variables:
 *   DATABASE_URL - Postgres connection string (required)
 *
 * For production deployment:
 * 1. Run bootstrap as master user first (creates extensions + roles)
 * 2. Run schema as bench_ddl (creates tables, owned by bench_ddl)
 */
import { Pool } from 'pg';
import {
  applyMigrations,
  applyBootstrapMigrations,
  applySchemaMigrations,
  rollbackMigration,
} from './index.js';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  DATABASE_URL=postgres://user:pass@host/db pnpm migrate');
    console.error('  DATABASE_URL=postgres://user:pass@host/db pnpm migrate --bootstrap');
    console.error('  DATABASE_URL=postgres://user:pass@host/db pnpm migrate --schema');
    console.error('  DATABASE_URL=postgres://user:pass@host/db pnpm migrate --rollback');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const args = process.argv.slice(2);
    const isRollback = args.includes('--rollback');
    const isBootstrapOnly = args.includes('--bootstrap');
    const isSchemaOnly = args.includes('--schema');

    if (isRollback) {
      console.log('Rolling back migration...');
      await rollbackMigration(pool);
    } else if (isBootstrapOnly) {
      console.log('Applying bootstrap migrations (run as master)...');
      await applyBootstrapMigrations(pool);
    } else if (isSchemaOnly) {
      console.log('Applying schema migrations (run as bench_ddl)...');
      await applySchemaMigrations(pool);
    } else {
      console.log('Applying all pending migrations...');
      await applyMigrations(pool);
    }

    console.log('Done.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

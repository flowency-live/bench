#!/usr/bin/env tsx
/**
 * Migration runner CLI
 *
 * Usage:
 *   pnpm migrate              # Apply all pending migrations
 *   pnpm migrate --rollback   # Roll back the most recent migration
 *
 * Environment variables:
 *   DATABASE_URL - Postgres connection string (required)
 *
 * Role model:
 *   Migrations should run as bench_ddl (schema owner with BYPASSRLS).
 *   The app connects as bench_app (no BYPASSRLS, subject to RLS).
 */
import { Pool } from 'pg';
import { applyMigrations, rollbackMigration } from './index.js';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const isRollback = process.argv.includes('--rollback');

    if (isRollback) {
      console.log('Rolling back migration...');
      await rollbackMigration(pool);
    } else {
      console.log('Applying migrations...');
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

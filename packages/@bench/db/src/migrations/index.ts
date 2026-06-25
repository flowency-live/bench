/**
 * Database migrations
 *
 * Two-phase migration model for Aurora compatibility:
 *
 * Phase 1 (bootstrap): Runs as master/rds_superuser
 * - Creates extensions (requires superuser)
 * - Creates bench_ddl and bench_app roles
 * - Sets up ALTER DEFAULT PRIVILEGES
 *
 * Phase 2 (schema): Runs as bench_ddl
 * - Creates tables, RLS policies, functions
 * - Tables owned by bench_ddl (has BYPASSRLS)
 * - SECURITY DEFINER function bypasses RLS for token lookup
 *
 * Tracks applied migrations in schema_migrations table.
 */
import type { Pool } from 'pg';
import {
  up as bootstrap000Up,
  down as bootstrap000Down,
  type BootstrapConfig,
  TEST_BOOTSTRAP_CONFIG,
} from './000-bootstrap.js';
import { up as migration001Up, down as migration001Down } from './001-initial-schema.js';

// Re-export for external use
export type { BootstrapConfig } from './000-bootstrap.js';
export { TEST_BOOTSTRAP_CONFIG } from './000-bootstrap.js';

interface SchemaMigration {
  readonly version: string;
  readonly name: string;
  readonly phase: 'schema';
  readonly up: (pool: Pool) => Promise<void>;
  readonly down: (pool: Pool) => Promise<void>;
}

interface BootstrapMigration {
  readonly version: string;
  readonly name: string;
  readonly phase: 'bootstrap';
  readonly up: (pool: Pool, config?: BootstrapConfig) => Promise<void>;
  readonly down: (pool: Pool) => Promise<void>;
}

type Migration = SchemaMigration | BootstrapMigration;

/**
 * All migrations in order.
 * Bootstrap migrations run as master, schema migrations run as bench_ddl.
 */
export const migrations: readonly Migration[] = [
  {
    version: '000',
    name: 'bootstrap',
    phase: 'bootstrap',
    up: bootstrap000Up,
    down: bootstrap000Down,
  },
  {
    version: '001',
    name: 'initial-schema',
    phase: 'schema',
    up: migration001Up,
    down: migration001Down,
  },
];

/**
 * Initialize the schema_migrations table if it doesn't exist
 */
async function initMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'schema',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return new Set(result.rows.map((row) => row.version));
}

/**
 * Apply all pending schema migrations
 */
export async function applyMigrations(
  pool: Pool,
  phase?: 'bootstrap' | 'schema'
): Promise<void> {
  await initMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  for (const migration of migrations) {
    // Skip if already applied
    if (applied.has(migration.version)) {
      continue;
    }

    // Skip if filtering by phase and this migration doesn't match
    if (phase && migration.phase !== phase) {
      continue;
    }

    // Bootstrap migrations should use applyBootstrapMigrations for proper config
    if (migration.phase === 'bootstrap') {
      throw new Error(
        `Bootstrap migration ${migration.version} requires config. Use applyBootstrapMigrations() instead.`
      );
    }

    console.log(`Applying migration ${migration.version}: ${migration.name} (${migration.phase})`);
    await migration.up(pool);

    await pool.query(
      'INSERT INTO schema_migrations (version, name, phase) VALUES ($1, $2, $3)',
      [migration.version, migration.name, migration.phase]
    );

    console.log(`Applied migration ${migration.version}: ${migration.name}`);
  }
}

/**
 * Apply only bootstrap migrations (run as master)
 *
 * @param pool - Database pool connected as master/rds_superuser
 * @param config - Role passwords (from Secrets Manager in production)
 */
export async function applyBootstrapMigrations(
  pool: Pool,
  config: BootstrapConfig = TEST_BOOTSTRAP_CONFIG
): Promise<void> {
  await initMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  for (const migration of migrations) {
    if (migration.phase !== 'bootstrap') {
      continue;
    }

    if (applied.has(migration.version)) {
      continue;
    }

    console.log(`Applying migration ${migration.version}: ${migration.name} (${migration.phase})`);
    await migration.up(pool, config);

    await pool.query(
      'INSERT INTO schema_migrations (version, name, phase) VALUES ($1, $2, $3)',
      [migration.version, migration.name, migration.phase]
    );

    console.log(`Applied migration ${migration.version}: ${migration.name}`);
  }
}

/**
 * Apply only schema migrations (run as bench_ddl)
 */
export async function applySchemaMigrations(pool: Pool): Promise<void> {
  return applyMigrations(pool, 'schema');
}

/**
 * Roll back the most recent migration
 */
export async function rollbackMigration(pool: Pool): Promise<void> {
  await initMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  // Find the last applied migration
  const appliedVersions = [...applied].sort().reverse();
  if (appliedVersions.length === 0) {
    console.log('No migrations to roll back');
    return;
  }

  const lastVersion = appliedVersions[0];
  const migration = migrations.find((m) => m.version === lastVersion);

  if (!migration) {
    throw new Error(`Migration ${lastVersion} not found in code`);
  }

  console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
  await migration.down(pool);

  await pool.query('DELETE FROM schema_migrations WHERE version = $1', [
    migration.version,
  ]);

  console.log(`Rolled back migration ${migration.version}: ${migration.name}`);
}

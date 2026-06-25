/**
 * Database migrations
 *
 * Simple migration runner for Aurora Postgres.
 * Tracks applied migrations in a schema_migrations table.
 */
import type { Pool } from 'pg';
import { up as migration001Up, down as migration001Down } from './001-initial-schema.js';

interface Migration {
  readonly version: string;
  readonly name: string;
  readonly up: (pool: Pool) => Promise<void>;
  readonly down: (pool: Pool) => Promise<void>;
}

const migrations: readonly Migration[] = [
  {
    version: '001',
    name: 'initial-schema',
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
 * Apply all pending migrations
 */
export async function applyMigrations(pool: Pool): Promise<void> {
  await initMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    await migration.up(pool);

    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );

    console.log(`Applied migration ${migration.version}: ${migration.name}`);
  }
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

export { migrations };

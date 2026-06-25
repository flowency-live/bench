/**
 * Bootstrap migration - runs as master/rds_superuser
 *
 * This migration:
 * 1. Creates extensions (requires superuser on Aurora)
 * 2. Creates the bench_ddl and bench_app roles
 * 3. Sets up ALTER DEFAULT PRIVILEGES so future tables auto-grant to bench_app
 *
 * Must run BEFORE 001-initial-schema, which runs as bench_ddl.
 *
 * On Aurora:
 * - The master user (rds_superuser) can CREATE EXTENSION
 * - bench_ddl is created with BYPASSRLS (for SECURITY DEFINER functions)
 * - bench_app is created without BYPASSRLS (runtime, subject to RLS)
 *
 * Role passwords:
 * - Production: Fetched from Secrets Manager (bench/aurora/ddl-credentials, bench/aurora/app-credentials)
 * - Tests: Use test passwords via BootstrapConfig
 */
import type { Pool } from 'pg';

/**
 * Configuration for bootstrap migration
 * Passwords should be fetched from Secrets Manager in production
 */
export interface BootstrapConfig {
  ddlPassword: string;
  appPassword: string;
}

/**
 * Default test passwords - ONLY for local development and tests
 * Production deployments MUST use Secrets Manager values
 */
export const TEST_BOOTSTRAP_CONFIG: BootstrapConfig = {
  ddlPassword: 'CHANGEME_DDL_PASSWORD',
  appPassword: 'CHANGEME_APP_PASSWORD',
};

export async function up(pool: Pool, config: BootstrapConfig = TEST_BOOTSTRAP_CONFIG): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ===========================================
    // Extensions (require superuser/rds_superuser on Aurora)
    // ===========================================
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ===========================================
    // Create bench_ddl role (schema owner, BYPASSRLS)
    // Migrations run as this role so SECURITY DEFINER functions
    // are owned by a role that bypasses RLS.
    // ===========================================
    // Pass password via session config, then use format() in DO block
    // This avoids SQL injection while working around DDL parameter limitations
    await client.query(`SELECT set_config('bench.ddl_password', $1, true)`, [config.ddlPassword]);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bench_ddl') THEN
          CREATE ROLE bench_ddl WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            BYPASSRLS;
        END IF;
        -- Use format() with %L for safe string literal escaping
        EXECUTE format('ALTER ROLE bench_ddl WITH PASSWORD %L', current_setting('bench.ddl_password'));
      END
      $$
    `);

    // Grant bench_ddl full access to public schema (so it can create tables)
    await client.query(`GRANT ALL ON SCHEMA public TO bench_ddl`);

    // ===========================================
    // Create bench_app role (runtime, NOBYPASSRLS)
    // The application connects as this role; it's subject to RLS.
    // ===========================================
    await client.query(`SELECT set_config('bench.app_password', $1, true)`, [config.appPassword]);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bench_app') THEN
          CREATE ROLE bench_app WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOBYPASSRLS;
        END IF;
        -- Use format() with %L for safe string literal escaping
        EXECUTE format('ALTER ROLE bench_app WITH PASSWORD %L', current_setting('bench.app_password'));
      END
      $$
    `);

    // Grant bench_app usage on public schema
    await client.query(`GRANT USAGE ON SCHEMA public TO bench_app`);

    // ===========================================
    // ALTER DEFAULT PRIVILEGES
    // Future tables created by bench_ddl auto-grant to bench_app
    // This means we don't need explicit grants after each migration.
    // ===========================================
    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bench_app
    `);

    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO bench_app
    `);

    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        GRANT EXECUTE ON FUNCTIONS TO bench_app
    `);

    // ===========================================
    // Create schema_migrations table and grant access
    // This table is created here so bench_ddl can access it
    // during the schema migration phase
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'schema',
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`GRANT SELECT, INSERT, DELETE ON schema_migrations TO bench_ddl`);
    await client.query(`GRANT SELECT ON schema_migrations TO bench_app`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove default privileges
    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM bench_app
    `);
    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        REVOKE USAGE, SELECT ON SEQUENCES FROM bench_app
    `);
    await client.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE bench_ddl IN SCHEMA public
        REVOKE EXECUTE ON FUNCTIONS FROM bench_app
    `);

    // Note: We don't drop roles or extensions in down migration
    // as they may be in use by other databases or roles

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

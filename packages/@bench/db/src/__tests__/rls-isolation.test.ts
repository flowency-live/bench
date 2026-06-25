/**
 * Cross-tenant RLS isolation tests
 *
 * Per CTO review (2026-06-25): These tests prove tenant A cannot SELECT/UPDATE
 * tenant B even with a raw query and a forged id. Pure unit mocks do not satisfy
 * this item - must use real Postgres via Testcontainers.
 *
 * Role model (mirrors production):
 * - bench_ddl: owns schema, has BYPASSRLS, runs migrations
 * - bench_app: runtime role, NOBYPASSRLS, non-owner, subject to RLS
 *
 * IMPORTANT: Tests run migrations as bench_ddl (non-superuser with BYPASSRLS),
 * NOT as postgres superuser. This ensures the test catches the Aurora behavior
 * where rds_superuser doesn't bypass RLS.
 *
 * REQUIRES: Docker to be running for Testcontainers.
 * These tests MUST run in CI with Docker - the isolation guarantee is unverified without them.
 *
 * To run locally: Install Docker Desktop, start it, then run `pnpm test`
 * To skip explicitly: Set SKIP_DOCKER_TESTS=true (only for local dev without Docker)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool as PoolType, PoolClient } from 'pg';

// Lazy imports to avoid errors when Docker isn't available
let PostgreSqlContainer: typeof import('@testcontainers/postgresql').PostgreSqlContainer;
let Pool: typeof import('pg').Pool;
let applyMigrations: typeof import('../migrations/index.js').applyMigrations;

// Check if Docker is available
async function checkDockerAvailable(): Promise<boolean> {
  if (process.env['SKIP_DOCKER_TESTS'] === 'true') {
    console.log('Skipping Docker tests: SKIP_DOCKER_TESTS=true');
    return false;
  }
  try {
    const { getContainerRuntimeClient } = await import('testcontainers');
    await getContainerRuntimeClient();
    return true;
  } catch {
    console.log('Skipping Docker tests: Container runtime not available');
    return false;
  }
}

/**
 * Setup the two-role model that mirrors production:
 * - bench_ddl: owns schema, has BYPASSRLS (for SECURITY DEFINER function)
 * - bench_app: runtime role, NOBYPASSRLS, non-owner (subject to RLS)
 */
async function setupRoles(superuserPool: PoolType): Promise<void> {
  // Create bench_ddl role with BYPASSRLS (schema owner for migrations)
  await superuserPool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bench_ddl') THEN
        CREATE ROLE bench_ddl WITH LOGIN PASSWORD 'ddl_password' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
      END IF;
    END
    $$;
  `);

  // Create bench_app role WITHOUT BYPASSRLS (runtime, subject to RLS)
  await superuserPool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bench_app') THEN
        CREATE ROLE bench_app WITH LOGIN PASSWORD 'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $$;
  `);

  // Grant CREATE on schema to bench_ddl (so it can create tables)
  await superuserPool.query(`GRANT ALL ON SCHEMA public TO bench_ddl`);
  await superuserPool.query(`GRANT USAGE ON SCHEMA public TO bench_app`);
}

/**
 * After migrations, grant bench_app access to tables and functions
 */
async function grantAppPermissions(ddlPool: PoolType): Promise<void> {
  await ddlPool.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bench_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bench_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bench_app;
  `);
}

describe('RLS tenant isolation', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;
  let appPool: PoolType | undefined;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      return;
    }

    // Lazy import dependencies
    const pgModule = await import('@testcontainers/postgresql');
    PostgreSqlContainer = pgModule.PostgreSqlContainer;
    const pg = await import('pg');
    Pool = pg.Pool;
    const migrations = await import('../migrations/index.js');
    applyMigrations = migrations.applyMigrations;

    // Start Postgres container
    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('bench_test')
      .withUsername('postgres')
      .withPassword('test_password')
      .start();

    // Superuser pool for initial role setup only
    superuserPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'postgres',
      password: 'test_password',
    });

    // Setup roles (bench_ddl with BYPASSRLS, bench_app without)
    await setupRoles(superuserPool);

    // DDL pool for migrations (non-superuser, but has BYPASSRLS)
    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'ddl_password',
    });

    // Apply migrations as bench_ddl (NOT as superuser)
    // This mirrors production where migrations run as rds_superuser-equivalent
    await applyMigrations(ddlPool);

    // Grant permissions to bench_app after tables exist
    await grantAppPermissions(ddlPool);

    // App pool uses non-owner role without BYPASSRLS (subject to RLS)
    appPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_app',
      password: 'app_password',
    });
  }, 120000); // 2 min timeout for container startup

  afterAll(async () => {
    await appPool?.end();
    await ddlPool?.end();
    await superuserPool?.end();
    await container?.stop();
  });

  beforeEach(async (ctx) => {
    if (!dockerAvailable || !ddlPool) {
      ctx.skip();
      return;
    }

    // Clean up test data (use ddlPool which has BYPASSRLS for cleanup)
    await ddlPool.query('DELETE FROM audit_events');
    await ddlPool.query('DELETE FROM magic_links');
    await ddlPool.query('DELETE FROM skills');
    await ddlPool.query('DELETE FROM stories');
    await ddlPool.query('DELETE FROM testimonials');
    await ddlPool.query('DELETE FROM assets');
    await ddlPool.query('DELETE FROM profiles');
    await ddlPool.query('DELETE FROM users');
    await ddlPool.query('DELETE FROM tenants');

    // Seed two tenants (as ddl role which bypasses RLS)
    await ddlPool.query(`
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES
        ($1, 'Tenant A', 'tenant-a', 'active', NOW(), NOW()),
        ($2, 'Tenant B', 'tenant-b', 'active', NOW(), NOW())
    `, [tenantA, tenantB]);

    // Seed profiles for each tenant
    await ddlPool.query(`
      INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
      VALUES
        ('p0000000-0000-0000-0000-000000000001', $1, 'Alice', 'alice@example.com', 'draft', NOW(), NOW()),
        ('p0000000-0000-0000-0000-000000000002', $2, 'Bob', 'bob@example.com', 'draft', NOW(), NOW())
    `, [tenantA, tenantB]);
  });

  describe('SELECT isolation', () => {
    it('tenant A can only see their own profiles', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        const result = await client.query('SELECT consultant_name FROM profiles');

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].consultant_name).toBe('Alice');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('tenant B cannot see tenant A profiles even with forged tenant_id in WHERE', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantB]);

        const result = await client.query(
          'SELECT consultant_name FROM profiles WHERE tenant_id = $1',
          [tenantA]
        );

        expect(result.rows).toHaveLength(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('without tenant context set, no rows are visible (fails closed)', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        // Don't set tenant context - NULLIF guard should return 0 rows, not error

        const result = await client.query('SELECT consultant_name FROM profiles');

        expect(result.rows).toHaveLength(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('INSERT isolation', () => {
    it('tenant A can insert profiles for their own tenant', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        await client.query(`
          INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
          VALUES ('p0000000-0000-0000-0000-000000000003', $1, 'Charlie', 'charlie@example.com', 'draft', NOW(), NOW())
        `, [tenantA]);

        const result = await client.query('SELECT consultant_name FROM profiles WHERE id = $1',
          ['p0000000-0000-0000-0000-000000000003']);
        expect(result.rows[0].consultant_name).toBe('Charlie');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('tenant A cannot insert profiles for tenant B (WITH CHECK)', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        await expect(
          client.query(`
            INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
            VALUES ('p0000000-0000-0000-0000-000000000004', $1, 'Evil', 'evil@example.com', 'draft', NOW(), NOW())
          `, [tenantB])
        ).rejects.toThrow(/row-level security/i);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('UPDATE isolation', () => {
    it('tenant A can update their own profiles', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        await client.query(
          `UPDATE profiles SET consultant_name = 'Alice Updated' WHERE id = $1`,
          ['p0000000-0000-0000-0000-000000000001']
        );

        const result = await client.query(
          'SELECT consultant_name FROM profiles WHERE id = $1',
          ['p0000000-0000-0000-0000-000000000001']
        );
        expect(result.rows[0].consultant_name).toBe('Alice Updated');

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('tenant A cannot update tenant B profiles', async (ctx) => {
      if (!appPool || !ddlPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        const result = await client.query(
          `UPDATE profiles SET consultant_name = 'Hacked' WHERE id = $1`,
          ['p0000000-0000-0000-0000-000000000002']
        );

        expect(result.rowCount).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // Verify via ddlPool (which bypasses RLS)
      const verify = await ddlPool.query(
        'SELECT consultant_name FROM profiles WHERE id = $1',
        ['p0000000-0000-0000-0000-000000000002']
      );
      expect(verify.rows[0].consultant_name).toBe('Bob');
    });

    it('tenant A cannot change tenant_id to tenant B (WITH CHECK)', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        await expect(
          client.query(
            `UPDATE profiles SET tenant_id = $1 WHERE id = $2`,
            [tenantB, 'p0000000-0000-0000-0000-000000000001']
          )
        ).rejects.toThrow(/row-level security/i);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  describe('DELETE isolation', () => {
    it('tenant A can delete their own profiles', async (ctx) => {
      if (!appPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        const result = await client.query(
          `DELETE FROM profiles WHERE id = $1`,
          ['p0000000-0000-0000-0000-000000000001']
        );

        expect(result.rowCount).toBe(1);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('tenant A cannot delete tenant B profiles', async (ctx) => {
      if (!appPool || !ddlPool) { ctx.skip(); return; }

      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

        const result = await client.query(
          `DELETE FROM profiles WHERE id = $1`,
          ['p0000000-0000-0000-0000-000000000002']
        );

        expect(result.rowCount).toBe(0);

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // Verify via ddlPool (which bypasses RLS)
      const verify = await ddlPool.query(
        'SELECT id FROM profiles WHERE id = $1',
        ['p0000000-0000-0000-0000-000000000002']
      );
      expect(verify.rows).toHaveLength(1);
    });
  });
});

describe('Magic link token lookup (cross-tenant system path)', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;
  let appPool: PoolType | undefined;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      return;
    }

    const pgModule = await import('@testcontainers/postgresql');
    PostgreSqlContainer = pgModule.PostgreSqlContainer;
    const pg = await import('pg');
    Pool = pg.Pool;
    const migrations = await import('../migrations/index.js');
    applyMigrations = migrations.applyMigrations;

    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('bench_test')
      .withUsername('postgres')
      .withPassword('test_password')
      .start();

    superuserPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'postgres',
      password: 'test_password',
    });

    await setupRoles(superuserPool);

    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'ddl_password',
    });

    // Apply migrations as bench_ddl (NOT as superuser)
    await applyMigrations(ddlPool);
    await grantAppPermissions(ddlPool);

    appPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_app',
      password: 'app_password',
    });
  }, 120000);

  afterAll(async () => {
    await appPool?.end();
    await ddlPool?.end();
    await superuserPool?.end();
    await container?.stop();
  });

  beforeEach(async (ctx) => {
    if (!dockerAvailable || !ddlPool) {
      ctx.skip();
      return;
    }

    await ddlPool.query('DELETE FROM audit_events');
    await ddlPool.query('DELETE FROM magic_links');
    await ddlPool.query('DELETE FROM skills');
    await ddlPool.query('DELETE FROM stories');
    await ddlPool.query('DELETE FROM testimonials');
    await ddlPool.query('DELETE FROM assets');
    await ddlPool.query('DELETE FROM profiles');
    await ddlPool.query('DELETE FROM users');
    await ddlPool.query('DELETE FROM tenants');

    await ddlPool.query(`
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES ($1, 'Tenant A', 'tenant-a', 'active', NOW(), NOW())
    `, [tenantA]);

    await ddlPool.query(`
      INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
      VALUES ('p0000000-0000-0000-0000-000000000001', $1, 'Alice', 'alice@example.com', 'draft', NOW(), NOW())
    `, [tenantA]);

    await ddlPool.query(`
      INSERT INTO magic_links (id, tenant_id, profile_id, type, token_hash, scope, status, expires_at, created_by, created_at, updated_at)
      VALUES ('l0000000-0000-0000-0000-000000000001', $1, 'p0000000-0000-0000-0000-000000000001', 'invite', 'hash123', 'edit', 'active', NOW() + INTERVAL '7 days', 'system', NOW(), NOW())
    `, [tenantA]);
  });

  it('lookup_magic_link_by_token_hash returns tenant context without requiring tenant to be set', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      // Intentionally NOT setting tenant context - this is the entry point
      // The SECURITY DEFINER function should bypass RLS because its owner (bench_ddl) has BYPASSRLS

      const result = await client.query(
        `SELECT * FROM lookup_magic_link_by_token_hash($1)`,
        ['hash123']
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].tenant_id).toBe(tenantA);
      expect(result.rows[0].profile_id).toBe('p0000000-0000-0000-0000-000000000001');
      expect(result.rows[0].scope).toBe('edit');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('lookup_magic_link_by_token_hash returns empty for non-existent token', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM lookup_magic_link_by_token_hash($1)`,
        ['nonexistent']
      );

      expect(result.rows).toHaveLength(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('after lookup, can set tenant context and access profile data', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Look up token (no tenant context needed)
      const linkResult = await client.query(
        `SELECT * FROM lookup_magic_link_by_token_hash($1)`,
        ['hash123']
      );
      const tenantId = linkResult.rows[0].tenant_id;

      // Step 2: Set tenant context based on lookup result
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Step 3: Now can access tenant-scoped data
      const profileResult = await client.query(
        `SELECT consultant_name FROM profiles WHERE id = $1`,
        [linkResult.rows[0].profile_id]
      );

      expect(profileResult.rows[0].consultant_name).toBe('Alice');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

describe('Tenants table RLS', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;
  let appPool: PoolType | undefined;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      return;
    }

    const pgModule = await import('@testcontainers/postgresql');
    PostgreSqlContainer = pgModule.PostgreSqlContainer;
    const pg = await import('pg');
    Pool = pg.Pool;
    const migrations = await import('../migrations/index.js');
    applyMigrations = migrations.applyMigrations;

    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('bench_test')
      .withUsername('postgres')
      .withPassword('test_password')
      .start();

    superuserPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'postgres',
      password: 'test_password',
    });

    await setupRoles(superuserPool);

    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'ddl_password',
    });

    await applyMigrations(ddlPool);
    await grantAppPermissions(ddlPool);

    appPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_app',
      password: 'app_password',
    });
  }, 120000);

  afterAll(async () => {
    await appPool?.end();
    await ddlPool?.end();
    await superuserPool?.end();
    await container?.stop();
  });

  beforeEach(async (ctx) => {
    if (!dockerAvailable || !ddlPool) {
      ctx.skip();
      return;
    }

    await ddlPool.query('DELETE FROM audit_events');
    await ddlPool.query('DELETE FROM magic_links');
    await ddlPool.query('DELETE FROM skills');
    await ddlPool.query('DELETE FROM stories');
    await ddlPool.query('DELETE FROM testimonials');
    await ddlPool.query('DELETE FROM assets');
    await ddlPool.query('DELETE FROM profiles');
    await ddlPool.query('DELETE FROM users');
    await ddlPool.query('DELETE FROM tenants');

    await ddlPool.query(`
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES
        ($1, 'Tenant A', 'tenant-a', 'active', NOW(), NOW()),
        ($2, 'Tenant B', 'tenant-b', 'active', NOW(), NOW())
    `, [tenantA, tenantB]);
  });

  it('tenant A can only see its own tenant row', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

      const result = await client.query('SELECT name, slug FROM tenants');

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].slug).toBe('tenant-a');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('tenant A cannot see tenant B row', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantA]);

      const result = await client.query('SELECT name FROM tenants WHERE id = $1', [tenantB]);

      expect(result.rows).toHaveLength(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

describe('pgvector extension', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;

  beforeAll(async () => {
    dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      return;
    }

    const pgModule = await import('@testcontainers/postgresql');
    PostgreSqlContainer = pgModule.PostgreSqlContainer;
    const pg = await import('pg');
    Pool = pg.Pool;
    const migrations = await import('../migrations/index.js');
    applyMigrations = migrations.applyMigrations;

    container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('bench_test')
      .withUsername('postgres')
      .withPassword('test_password')
      .start();

    superuserPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'postgres',
      password: 'test_password',
    });

    await setupRoles(superuserPool);

    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'ddl_password',
    });

    await applyMigrations(ddlPool);
  }, 120000);

  afterAll(async () => {
    await ddlPool?.end();
    await superuserPool?.end();
    await container?.stop();
  });

  it('pgvector extension is enabled', async (ctx) => {
    if (!ddlPool) { ctx.skip(); return; }

    const result = await ddlPool.query(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].extname).toBe('vector');
  });
});

/**
 * Tenant context tests
 *
 * Tests the tenant context wrapper that:
 * - Sets app.current_tenant_id per transaction
 * - Ensures all queries are scoped to the current tenant
 * - Handles transactions properly with BEGIN/COMMIT/ROLLBACK
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool as PoolType } from 'pg';

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

describe('TenantContext', () => {
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
    const PostgreSqlContainer = pgModule.PostgreSqlContainer;
    const pg = await import('pg');
    const Pool = pg.Pool;
    const { applyBootstrapMigrations, applySchemaMigrations } = await import('../../migrations/index.js');

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

    // Apply bootstrap as superuser (creates roles, extensions)
    await applyBootstrapMigrations(superuserPool);

    // Create ddl pool
    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'CHANGEME_DDL_PASSWORD',
    });

    // Apply schema as bench_ddl
    await applySchemaMigrations(ddlPool);

    // Create app pool
    appPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_app',
      password: 'CHANGEME_APP_PASSWORD',
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

    // Clean up and seed test data
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

    await ddlPool.query(`
      INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
      VALUES
        ('p0000000-0000-0000-0000-000000000001', $1, 'Alice', 'alice@example.com', 'draft', NOW(), NOW()),
        ('p0000000-0000-0000-0000-000000000002', $2, 'Bob', 'bob@example.com', 'draft', NOW(), NOW())
    `, [tenantA, tenantB]);
  });

  it('withTenant scopes queries to the specified tenant', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createTenantContext } = await import('../tenant-context.js');
    const tenantContext = createTenantContext(appPool);

    const result = await tenantContext.withTenant(tenantA, async (client) => {
      const res = await client.query('SELECT consultant_name FROM profiles');
      return res.rows;
    });

    expect(result).toHaveLength(1);
    expect(result[0].consultant_name).toBe('Alice');
  });

  it('withTenant isolates tenant B from tenant A data', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createTenantContext } = await import('../tenant-context.js');
    const tenantContext = createTenantContext(appPool);

    const result = await tenantContext.withTenant(tenantB, async (client) => {
      const res = await client.query('SELECT consultant_name FROM profiles');
      return res.rows;
    });

    expect(result).toHaveLength(1);
    expect(result[0].consultant_name).toBe('Bob');
  });

  it('withTenant commits on success', async (ctx) => {
    if (!appPool || !ddlPool) { ctx.skip(); return; }

    const { createTenantContext } = await import('../tenant-context.js');
    const tenantContext = createTenantContext(appPool);

    await tenantContext.withTenant(tenantA, async (client) => {
      await client.query(
        `UPDATE profiles SET consultant_name = 'Alice Updated' WHERE id = $1`,
        ['p0000000-0000-0000-0000-000000000001']
      );
    });

    // Verify change persisted (using ddlPool which bypasses RLS)
    const verify = await ddlPool.query(
      'SELECT consultant_name FROM profiles WHERE id = $1',
      ['p0000000-0000-0000-0000-000000000001']
    );
    expect(verify.rows[0].consultant_name).toBe('Alice Updated');
  });

  it('withTenant rolls back on error', async (ctx) => {
    if (!appPool || !ddlPool) { ctx.skip(); return; }

    const { createTenantContext } = await import('../tenant-context.js');
    const tenantContext = createTenantContext(appPool);

    await expect(
      tenantContext.withTenant(tenantA, async (client) => {
        await client.query(
          `UPDATE profiles SET consultant_name = 'Should Rollback' WHERE id = $1`,
          ['p0000000-0000-0000-0000-000000000001']
        );
        throw new Error('Intentional error');
      })
    ).rejects.toThrow('Intentional error');

    // Verify change was rolled back
    const verify = await ddlPool.query(
      'SELECT consultant_name FROM profiles WHERE id = $1',
      ['p0000000-0000-0000-0000-000000000001']
    );
    expect(verify.rows[0].consultant_name).toBe('Alice');
  });

  it('withTenant prevents cross-tenant writes', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createTenantContext } = await import('../tenant-context.js');
    const tenantContext = createTenantContext(appPool);

    // Tenant A trying to update tenant B's profile should fail
    const rowsAffected = await tenantContext.withTenant(tenantA, async (client) => {
      const res = await client.query(
        `UPDATE profiles SET consultant_name = 'Hacked' WHERE id = $1`,
        ['p0000000-0000-0000-0000-000000000002']
      );
      return res.rowCount;
    });

    expect(rowsAffected).toBe(0);
  });
});

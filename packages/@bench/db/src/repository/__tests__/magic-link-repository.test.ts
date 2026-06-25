/**
 * Magic link repository tests
 *
 * Tests the magic link repository which:
 * - Looks up tokens via SECURITY DEFINER function (cross-tenant)
 * - Creates/updates magic links within tenant context
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool as PoolType } from 'pg';

async function checkDockerAvailable(): Promise<boolean> {
  if (process.env['SKIP_DOCKER_TESTS'] === 'true') {
    return false;
  }
  try {
    const { getContainerRuntimeClient } = await import('testcontainers');
    await getContainerRuntimeClient();
    return true;
  } catch {
    return false;
  }
}

describe('MagicLinkRepository', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;
  let appPool: PoolType | undefined;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const profileId = 'e0000000-0000-0000-0000-000000000001';
  const linkId = 'f0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      console.log('Skipping Docker tests: Container runtime not available');
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

    await applyBootstrapMigrations(superuserPool);

    ddlPool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: 'bench_test',
      user: 'bench_ddl',
      password: 'CHANGEME_DDL_PASSWORD',
    });

    await applySchemaMigrations(ddlPool);

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

    await ddlPool.query('DELETE FROM audit_events');
    await ddlPool.query('DELETE FROM magic_links');
    await ddlPool.query('DELETE FROM profiles');
    await ddlPool.query('DELETE FROM tenants');

    await ddlPool.query(`
      INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
      VALUES ($1, 'Tenant A', 'tenant-a', 'active', NOW(), NOW())
    `, [tenantA]);

    await ddlPool.query(`
      INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
      VALUES ($1, $2, 'Alice', 'alice@example.com', 'draft', NOW(), NOW())
    `, [profileId, tenantA]);

    await ddlPool.query(`
      INSERT INTO magic_links (id, tenant_id, profile_id, type, token_hash, scope, status, expires_at, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, 'invite', 'hash123', 'edit', 'active', NOW() + INTERVAL '7 days', 'system', NOW(), NOW())
    `, [linkId, tenantA, profileId]);
  });

  it('lookupByTokenHash finds link without tenant context', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createMagicLinkRepository } = await import('../magic-link-repository.js');
    const repo = createMagicLinkRepository(appPool);

    // No tenant context - this is the entry point for token validation
    const result = await repo.lookupByTokenHash('hash123');

    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe(tenantA);
    expect(result?.profileId).toBe(profileId);
    expect(result?.scope).toBe('edit');
    expect(result?.status).toBe('active');
  });

  it('lookupByTokenHash returns null for non-existent token', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createMagicLinkRepository } = await import('../magic-link-repository.js');
    const repo = createMagicLinkRepository(appPool);

    const result = await repo.lookupByTokenHash('nonexistent');

    expect(result).toBeNull();
  });

  it('findById finds link within tenant context', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createMagicLinkRepository } = await import('../magic-link-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createMagicLinkRepository(appPool);
    const ctx2 = createTenantContext(appPool);

    const result = await ctx2.withTenant(tenantA, async (client) => {
      return repo.findById(linkId, client);
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(linkId);
    expect(result?.scope).toBe('edit');
  });

  it('markAsUsed updates link status within tenant context', async (ctx) => {
    if (!appPool || !ddlPool) { ctx.skip(); return; }

    const { createMagicLinkRepository } = await import('../magic-link-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createMagicLinkRepository(appPool);
    const ctx2 = createTenantContext(appPool);

    await ctx2.withTenant(tenantA, async (client) => {
      await repo.markAsUsed(linkId, client);
    });

    // Verify status changed
    const verify = await ddlPool.query(
      'SELECT status FROM magic_links WHERE id = $1',
      [linkId]
    );
    expect(verify.rows[0].status).toBe('used');
  });
});

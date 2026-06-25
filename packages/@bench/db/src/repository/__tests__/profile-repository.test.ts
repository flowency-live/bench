/**
 * Profile repository tests
 *
 * Tests the profile repository which provides tenant-scoped
 * CRUD operations for consultant profiles.
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

describe('ProfileRepository', () => {
  let dockerAvailable = false;
  let container: StartedPostgreSqlContainer | undefined;
  let superuserPool: PoolType | undefined;
  let ddlPool: PoolType | undefined;
  let appPool: PoolType | undefined;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  const profileA = 'p0000000-0000-0000-0000-000000000001';
  const profileB = 'p0000000-0000-0000-0000-000000000002';

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
        ($1, $3, 'Alice', 'alice@example.com', 'draft', NOW(), NOW()),
        ($2, $4, 'Bob', 'bob@example.com', 'published', NOW(), NOW())
    `, [profileA, profileB, tenantA, tenantB]);
  });

  it('findAll returns only profiles for current tenant', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    const profiles = await tenantCtx.withTenant(tenantA, async (client) => {
      return repo.findAll(client);
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].consultantName).toBe('Alice');
    expect(profiles[0].tenantId).toBe(tenantA);
  });

  it('findById returns profile within tenant context', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    const profile = await tenantCtx.withTenant(tenantA, async (client) => {
      return repo.findById(profileA, client);
    });

    expect(profile).not.toBeNull();
    expect(profile?.consultantName).toBe('Alice');
    expect(profile?.status).toBe('draft');
  });

  it('findById returns null for other tenant profile', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    // Tenant A trying to find tenant B's profile
    const profile = await tenantCtx.withTenant(tenantA, async (client) => {
      return repo.findById(profileB, client);
    });

    expect(profile).toBeNull();
  });

  it('findByStatus returns profiles matching status', async (ctx) => {
    if (!appPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    // Add another profile to tenant A with published status
    await ddlPool!.query(`
      INSERT INTO profiles (id, tenant_id, consultant_name, consultant_email, status, created_at, updated_at)
      VALUES ('p0000000-0000-0000-0000-000000000003', $1, 'Charlie', 'charlie@example.com', 'published', NOW(), NOW())
    `, [tenantA]);

    const profiles = await tenantCtx.withTenant(tenantA, async (client) => {
      return repo.findByStatus('published', client);
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].consultantName).toBe('Charlie');
  });

  it('updateStatus changes profile status', async (ctx) => {
    if (!appPool || !ddlPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    await tenantCtx.withTenant(tenantA, async (client) => {
      await repo.updateStatus(profileA, 'submitted', client);
    });

    // Verify status changed
    const verify = await ddlPool.query(
      'SELECT status FROM profiles WHERE id = $1',
      [profileA]
    );
    expect(verify.rows[0].status).toBe('submitted');
  });

  it('updatePositioning updates headline and bio', async (ctx) => {
    if (!appPool || !ddlPool) { ctx.skip(); return; }

    const { createProfileRepository } = await import('../profile-repository.js');
    const { createTenantContext } = await import('../tenant-context.js');

    const repo = createProfileRepository(appPool);
    const tenantCtx = createTenantContext(appPool);

    await tenantCtx.withTenant(tenantA, async (client) => {
      await repo.updatePositioning(profileA, {
        headline: 'Expert Consultant',
        bio: 'Helping organizations transform.',
      }, client);
    });

    // Verify positioning updated
    const verify = await ddlPool.query(
      'SELECT headline, bio FROM profiles WHERE id = $1',
      [profileA]
    );
    expect(verify.rows[0].headline).toBe('Expert Consultant');
    expect(verify.rows[0].bio).toBe('Helping organizations transform.');
  });
});

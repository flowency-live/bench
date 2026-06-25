/**
 * Initial schema migration
 *
 * Creates all §10 entities with RLS policies per ADR-0002:
 * - Tenant, User, Profile, Skill, Story, Testimonial, Asset, MagicLink, AuditEvent
 *
 * Role model (CTO review fix):
 * - bench_ddl: owns schema + lookup function, has BYPASSRLS, migrations run as this
 * - bench_app: runtime role, NOBYPASSRLS, non-owner, app connects as this
 *
 * RLS enforcement:
 * - ENABLE + FORCE ROW LEVEL SECURITY on all tenant-scoped tables
 * - Policies use NULLIF guard to fail closed on empty context
 * - WITH CHECK on INSERT/UPDATE to prevent cross-tenant writes
 * - Token lookup via SECURITY DEFINER function owned by bench_ddl (bypasses RLS)
 *
 * pgvector enabled for V2 semantic matching.
 */
import type { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable pgvector extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Enable uuid-ossp for uuid generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ===========================================
    // Tenant table (not tenant-scoped - this IS the tenant)
    // RLS: a tenant can only read its own row
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial')),
        brand_tokens JSONB NOT NULL DEFAULT '{}',
        custom_domain TEXT,
        trial_ends_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // User table (tenant-scoped owners/admins)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        auth_provider TEXT NOT NULL DEFAULT 'cognito',
        role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, email)
      )
    `);

    // ===========================================
    // Profile table (tenant-scoped)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        consultant_name TEXT NOT NULL,
        consultant_email TEXT NOT NULL,
        role TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'invited', 'in_progress', 'submitted', 'published', 'archived')),
        headline TEXT,
        bio TEXT,
        headshot_asset_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        archived_at TIMESTAMPTZ
      )
    `);

    // ===========================================
    // Skill table (belongs to profile)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // Story table (belongs to profile)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        client_tag TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // Testimonial table (belongs to profile)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        quote TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        author_company TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // Asset table (belongs to profile)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('headshot', 'logo', 'document')),
        original_key TEXT NOT NULL,
        processed_key TEXT,
        width INTEGER,
        height INTEGER,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // MagicLink table (tenant-scoped)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS magic_links (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('invite', 'share')),
        token_hash TEXT NOT NULL UNIQUE,
        scope TEXT NOT NULL CHECK (scope IN ('edit', 'view')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
        passcode_hash TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Index on token_hash for fast lookups (cross-tenant query)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash)
    `);

    // ===========================================
    // AuditEvent table (tenant-scoped)
    // ===========================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        link_id UUID REFERENCES magic_links(id) ON DELETE SET NULL,
        kind TEXT NOT NULL CHECK (kind IN (
          'link_created', 'link_sent', 'link_opened', 'link_revoked', 'link_expired',
          'profile_created', 'profile_updated', 'profile_submitted', 'profile_published', 'profile_archived'
        )),
        actor TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ===========================================
    // Enable Row-Level Security on tenants table
    // A tenant can only read its own row
    // ===========================================
    await client.query(`ALTER TABLE tenants ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE tenants FORCE ROW LEVEL SECURITY`);

    // Tenants table: only see your own tenant row
    // NULLIF guard ensures empty/unset context returns 0 rows (fail closed)
    await client.query(`
      CREATE POLICY tenants_self_select ON tenants
        FOR SELECT
        USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);

    // Tenants are created via a system path (admin/onboarding), not by app role
    // No INSERT/UPDATE/DELETE policies - those operations require elevated privileges

    // ===========================================
    // Enable Row-Level Security on tenant-scoped tables
    // FORCE ensures even table owners are subject to RLS
    // NULLIF guard fails closed on empty/unset context (returns 0 rows, not error)
    // ===========================================
    const tenantScopedTables = [
      'users',
      'profiles',
      'skills',
      'stories',
      'testimonials',
      'assets',
      'magic_links',
      'audit_events',
    ];

    for (const table of tenantScopedTables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // Policy for SELECT: only see rows matching current tenant
      // NULLIF ensures empty string → NULL → no match (0 rows, not error)
      await client.query(`
        CREATE POLICY ${table}_tenant_select ON ${table}
          FOR SELECT
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);

      // Policy for INSERT: can only insert with matching tenant_id
      await client.query(`
        CREATE POLICY ${table}_tenant_insert ON ${table}
          FOR INSERT
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);

      // Policy for UPDATE: can only update own rows and can't change tenant_id
      await client.query(`
        CREATE POLICY ${table}_tenant_update ON ${table}
          FOR UPDATE
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);

      // Policy for DELETE: can only delete own rows
      await client.query(`
        CREATE POLICY ${table}_tenant_delete ON ${table}
          FOR DELETE
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);
    }

    // ===========================================
    // SECURITY DEFINER function for cross-tenant token lookup
    // This is the ONE place we bypass RLS - to resolve tenant from token
    //
    // IMPORTANT: This function must be owned by a role with BYPASSRLS (bench_ddl)
    // so it can query magic_links without tenant context. The function is called
    // to RESOLVE the tenant from a token, before any context is set.
    //
    // On Aurora: the master user is rds_superuser (not a true superuser), so
    // if the function owner doesn't have BYPASSRLS, the function is subject to
    // RLS and fails with no context set.
    // ===========================================
    await client.query(`
      CREATE OR REPLACE FUNCTION lookup_magic_link_by_token_hash(p_token_hash TEXT)
      RETURNS TABLE (
        id UUID,
        tenant_id UUID,
        profile_id UUID,
        type TEXT,
        scope TEXT,
        status TEXT,
        passcode_hash TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- This function runs with definer's privileges (owner with BYPASSRLS)
        -- bypassing RLS to allow cross-tenant token lookup.
        -- The owner MUST have BYPASSRLS attribute for this to work on Aurora.
        RETURN QUERY
        SELECT
          ml.id,
          ml.tenant_id,
          ml.profile_id,
          ml.type,
          ml.scope,
          ml.status,
          ml.passcode_hash,
          ml.expires_at,
          ml.created_at
        FROM magic_links ml
        WHERE ml.token_hash = p_token_hash
        LIMIT 1;
      END;
      $$
    `);

    // ===========================================
    // Additional indexes for common queries
    // ===========================================
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_skills_profile_id ON skills(profile_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stories_profile_id ON stories(profile_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_profile_id ON audit_events(profile_id, created_at)`);

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

    // Drop in reverse order of creation (respecting foreign keys)
    await client.query('DROP FUNCTION IF EXISTS lookup_magic_link_by_token_hash');
    await client.query('DROP TABLE IF EXISTS audit_events CASCADE');
    await client.query('DROP TABLE IF EXISTS magic_links CASCADE');
    await client.query('DROP TABLE IF EXISTS assets CASCADE');
    await client.query('DROP TABLE IF EXISTS testimonials CASCADE');
    await client.query('DROP TABLE IF EXISTS stories CASCADE');
    await client.query('DROP TABLE IF EXISTS skills CASCADE');
    await client.query('DROP TABLE IF EXISTS profiles CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS tenants CASCADE');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Magic link repository
 *
 * Provides data access for magic links:
 * - Token lookup via SECURITY DEFINER function (cross-tenant, no context needed)
 * - CRUD operations within tenant context
 *
 * The token lookup is the ONE cross-tenant read - it resolves tenant from token.
 * All other operations require tenant context via TenantContext.withTenant().
 */
import type { Pool, PoolClient } from 'pg';

/**
 * Magic link lookup result (from SECURITY DEFINER function)
 */
export interface MagicLinkLookup {
  readonly id: string;
  readonly tenantId: string;
  readonly profileId: string;
  readonly type: 'invite' | 'share';
  readonly scope: 'edit' | 'view';
  readonly status: 'active' | 'used' | 'expired' | 'revoked';
  readonly passcodeHash: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/**
 * Full magic link entity
 */
export interface MagicLink extends MagicLinkLookup {
  readonly createdBy: string;
  readonly updatedAt: Date;
}

/**
 * Magic link repository interface
 */
export interface MagicLinkRepository {
  /**
   * Look up a magic link by token hash (cross-tenant, no context needed).
   * Uses SECURITY DEFINER function to bypass RLS.
   *
   * This is the entry point for validating a magic link token.
   * Returns tenant info so caller can establish tenant context.
   *
   * @param tokenHash - SHA-256 hash of the token
   * @returns Magic link lookup result or null if not found
   */
  lookupByTokenHash(tokenHash: string): Promise<MagicLinkLookup | null>;

  /**
   * Find a magic link by ID within tenant context.
   * Must be called within TenantContext.withTenant().
   *
   * @param id - Magic link UUID
   * @param client - Database client from tenant context
   * @returns Magic link or null if not found
   */
  findById(id: string, client: PoolClient): Promise<MagicLink | null>;

  /**
   * Mark a magic link as used within tenant context.
   * Must be called within TenantContext.withTenant().
   *
   * @param id - Magic link UUID
   * @param client - Database client from tenant context
   */
  markAsUsed(id: string, client: PoolClient): Promise<void>;

  /**
   * Mark a magic link as revoked within tenant context.
   * Must be called within TenantContext.withTenant().
   *
   * @param id - Magic link UUID
   * @param client - Database client from tenant context
   */
  markAsRevoked(id: string, client: PoolClient): Promise<void>;
}

/**
 * Create a magic link repository.
 *
 * @param pool - Database connection pool (connects as bench_app)
 * @returns MagicLinkRepository instance
 */
export function createMagicLinkRepository(pool: Pool): MagicLinkRepository {
  return {
    async lookupByTokenHash(tokenHash: string): Promise<MagicLinkLookup | null> {
      // Uses SECURITY DEFINER function - no tenant context needed
      const result = await pool.query<{
        id: string;
        tenant_id: string;
        profile_id: string;
        type: string;
        scope: string;
        status: string;
        passcode_hash: string | null;
        expires_at: Date;
        created_at: Date;
      }>(
        'SELECT * FROM lookup_magic_link_by_token_hash($1)',
        [tokenHash]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        tenantId: row.tenant_id,
        profileId: row.profile_id,
        type: row.type as 'invite' | 'share',
        scope: row.scope as 'edit' | 'view',
        status: row.status as 'active' | 'used' | 'expired' | 'revoked',
        passcodeHash: row.passcode_hash,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    },

    async findById(id: string, client: PoolClient): Promise<MagicLink | null> {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        profile_id: string;
        type: string;
        scope: string;
        status: string;
        passcode_hash: string | null;
        expires_at: Date;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, tenant_id, profile_id, type, scope, status, passcode_hash,
                expires_at, created_by, created_at, updated_at
         FROM magic_links
         WHERE id = $1`,
        [id]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        tenantId: row.tenant_id,
        profileId: row.profile_id,
        type: row.type as 'invite' | 'share',
        scope: row.scope as 'edit' | 'view',
        status: row.status as 'active' | 'used' | 'expired' | 'revoked',
        passcodeHash: row.passcode_hash,
        expiresAt: row.expires_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async markAsUsed(id: string, client: PoolClient): Promise<void> {
      await client.query(
        `UPDATE magic_links SET status = 'used', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    },

    async markAsRevoked(id: string, client: PoolClient): Promise<void> {
      await client.query(
        `UPDATE magic_links SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    },
  };
}

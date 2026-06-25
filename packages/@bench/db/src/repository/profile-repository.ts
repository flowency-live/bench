/**
 * Profile repository
 *
 * Provides tenant-scoped data access for consultant profiles.
 * All operations must be called within TenantContext.withTenant().
 *
 * The profile entity represents a consultant's professional profile
 * with positioning (headline, bio), skills, stories, and testimonials.
 */
import type { Pool, PoolClient } from 'pg';

/**
 * Profile status
 */
export type ProfileStatus =
  | 'draft'
  | 'invited'
  | 'in_progress'
  | 'submitted'
  | 'published'
  | 'archived';

/**
 * Profile entity
 */
export interface Profile {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly headshotAssetId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly archivedAt: Date | null;
}

/**
 * Profile summary for listing
 */
export interface ProfileSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly consultantName: string;
  readonly role: string | null;
  readonly status: ProfileStatus;
  readonly updatedAt: Date;
}

/**
 * Positioning update
 */
export interface PositioningUpdate {
  readonly headline: string;
  readonly bio: string;
}

/**
 * Profile repository interface
 */
export interface ProfileRepository {
  /**
   * Find all profiles for the current tenant.
   */
  findAll(client: PoolClient): Promise<ProfileSummary[]>;

  /**
   * Find profiles by status for the current tenant.
   */
  findByStatus(status: ProfileStatus, client: PoolClient): Promise<ProfileSummary[]>;

  /**
   * Find a profile by ID within the current tenant.
   */
  findById(id: string, client: PoolClient): Promise<Profile | null>;

  /**
   * Update profile status.
   */
  updateStatus(id: string, status: ProfileStatus, client: PoolClient): Promise<void>;

  /**
   * Update profile positioning (headline and bio).
   */
  updatePositioning(
    id: string,
    positioning: PositioningUpdate,
    client: PoolClient
  ): Promise<void>;

  /**
   * Update headshot asset ID.
   */
  updateHeadshot(
    id: string,
    assetId: string | null,
    client: PoolClient
  ): Promise<void>;
}

function mapRowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    consultantName: row.consultant_name as string,
    consultantEmail: row.consultant_email as string,
    role: row.role as string | null,
    status: row.status as ProfileStatus,
    headline: row.headline as string | null,
    bio: row.bio as string | null,
    headshotAssetId: row.headshot_asset_id as string | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    submittedAt: row.submitted_at as Date | null,
    publishedAt: row.published_at as Date | null,
    archivedAt: row.archived_at as Date | null,
  };
}

function mapRowToSummary(row: Record<string, unknown>): ProfileSummary {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    consultantName: row.consultant_name as string,
    role: row.role as string | null,
    status: row.status as ProfileStatus,
    updatedAt: row.updated_at as Date,
  };
}

/**
 * Create a profile repository.
 *
 * @param _pool - Database connection pool (unused, kept for consistency)
 * @returns ProfileRepository instance
 */
export function createProfileRepository(_pool: Pool): ProfileRepository {
  return {
    async findAll(client: PoolClient): Promise<ProfileSummary[]> {
      const result = await client.query(
        `SELECT id, tenant_id, consultant_name, role, status, updated_at
         FROM profiles
         ORDER BY updated_at DESC`
      );
      return result.rows.map(mapRowToSummary);
    },

    async findByStatus(
      status: ProfileStatus,
      client: PoolClient
    ): Promise<ProfileSummary[]> {
      const result = await client.query(
        `SELECT id, tenant_id, consultant_name, role, status, updated_at
         FROM profiles
         WHERE status = $1
         ORDER BY updated_at DESC`,
        [status]
      );
      return result.rows.map(mapRowToSummary);
    },

    async findById(id: string, client: PoolClient): Promise<Profile | null> {
      const result = await client.query(
        `SELECT id, tenant_id, consultant_name, consultant_email, role, status,
                headline, bio, headshot_asset_id, created_at, updated_at,
                submitted_at, published_at, archived_at
         FROM profiles
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapRowToProfile(result.rows[0]);
    },

    async updateStatus(
      id: string,
      status: ProfileStatus,
      client: PoolClient
    ): Promise<void> {
      const timestampColumn = getStatusTimestampColumn(status);
      const setClause = timestampColumn
        ? `status = $2, ${timestampColumn} = NOW(), updated_at = NOW()`
        : 'status = $2, updated_at = NOW()';

      await client.query(
        `UPDATE profiles SET ${setClause} WHERE id = $1`,
        [id, status]
      );
    },

    async updatePositioning(
      id: string,
      positioning: PositioningUpdate,
      client: PoolClient
    ): Promise<void> {
      await client.query(
        `UPDATE profiles
         SET headline = $2, bio = $3, updated_at = NOW()
         WHERE id = $1`,
        [id, positioning.headline, positioning.bio]
      );
    },

    async updateHeadshot(
      id: string,
      assetId: string | null,
      client: PoolClient
    ): Promise<void> {
      await client.query(
        `UPDATE profiles
         SET headshot_asset_id = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, assetId]
      );
    },
  };
}

/**
 * Get the timestamp column name for a status transition.
 */
function getStatusTimestampColumn(status: ProfileStatus): string | null {
  switch (status) {
    case 'submitted':
      return 'submitted_at';
    case 'published':
      return 'published_at';
    case 'archived':
      return 'archived_at';
    default:
      return null;
  }
}

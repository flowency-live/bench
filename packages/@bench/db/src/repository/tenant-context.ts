/**
 * Tenant context for multi-tenant database access
 *
 * Wraps database operations with proper tenant isolation:
 * - BEGIN transaction
 * - SET LOCAL app.current_tenant_id (transaction-scoped, safe with RDS Proxy)
 * - Execute queries (RLS enforces isolation)
 * - COMMIT on success, ROLLBACK on error
 *
 * Usage:
 *   const ctx = createTenantContext(pool);
 *   const profiles = await ctx.withTenant(tenantId, async (client) => {
 *     return client.query('SELECT * FROM profiles');
 *   });
 */
import type { Pool, PoolClient } from 'pg';

/**
 * Interface for tenant-scoped database operations
 */
export interface TenantContext {
  /**
   * Execute a function within a tenant-scoped transaction.
   *
   * @param tenantId - UUID of the tenant
   * @param fn - Function to execute with the tenant context set
   * @returns The result of the function
   * @throws Re-throws any error after rolling back the transaction
   */
  withTenant<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T>;
}

/**
 * Create a tenant context wrapper for a database pool.
 *
 * The pool should connect as bench_app (the runtime role subject to RLS).
 *
 * @param pool - Database connection pool
 * @returns TenantContext instance
 */
export function createTenantContext(pool: Pool): TenantContext {
  return {
    async withTenant<T>(
      tenantId: string,
      fn: (client: PoolClient) => Promise<T>
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // SET LOCAL is transaction-scoped (safe with RDS Proxy multiplexing)
        // set_config with true = transaction-local (equivalent to SET LOCAL)
        await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

        const result = await fn(client);

        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

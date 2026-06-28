/**
 * MagicLinkRepository accessor for the UI.
 * DynamoDB single-table design (GSI3 token lookup per ADR-0008).
 */

export type MagicLinkType = 'invite' | 'share';
export type MagicLinkScope = 'edit' | 'view';
export type MagicLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

/** Input for creating a magic link (token hash already computed by the caller). */
export interface CreateMagicLinkInput {
  readonly id: string;
  readonly profileId: string;
  readonly type: MagicLinkType;
  readonly scope: MagicLinkScope;
  readonly tokenHash: string;
  readonly passcodeHash?: string;
  readonly expiresAt: string;
  readonly createdBy: string;
}

/** Result of a GSI3 token-hash lookup (carries tenant context). */
export interface MagicLinkLookup {
  readonly id: string;
  readonly tenantId: string;
  readonly profileId: string;
  readonly type: MagicLinkType;
  readonly scope: MagicLinkScope;
  readonly status: MagicLinkStatus;
  readonly passcodeHash: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
}

/** Full magic link (within tenant context) — adds the issuer + update time. */
export interface MagicLink extends MagicLinkLookup {
  readonly createdBy: string;
  readonly updatedAt: string;
}

/**
 * The slice of the magic-link contract the UI needs:
 *  - create (mint)
 *  - lookupByTokenHash (resolve token → tenant context, the one global read)
 *  - findById (read the full link, incl. `createdBy`, within tenant context)
 *  - markAsUsed (single-use enforcement after a successful claim/verify)
 */
export interface MagicLinkRepository {
  create(tenantId: string, input: CreateMagicLinkInput): Promise<{ id: string }>;
  lookupByTokenHash(tokenHash: string): Promise<MagicLinkLookup | null>;
  findById(tenantId: string, profileId: string, linkId: string): Promise<MagicLink | null>;
  markAsUsed(tenantId: string, profileId: string, linkId: string): Promise<void>;
}

let instance: MagicLinkRepository | null = null;

/**
 * Get the DynamoDB magic-link repository.
 */
export function getMagicLinkRepository(): MagicLinkRepository {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const { createClient, createMagicLinkRepository } = require('@bench/data') as typeof import('@bench/data');

  const repo = createMagicLinkRepository(
    createClient({ region: process.env.AWS_REGION ?? 'eu-west-2' }),
    tableName,
  );

  instance = {
    create: (tenantId, input) => repo.create(tenantId, input),
    lookupByTokenHash: (tokenHash) => repo.lookupByTokenHash(tokenHash),
    findById: (tenantId, profileId, linkId) => repo.findById(tenantId, profileId, linkId),
    markAsUsed: (tenantId, profileId, linkId) => repo.markAsUsed(tenantId, profileId, linkId),
  };

  return instance;
}

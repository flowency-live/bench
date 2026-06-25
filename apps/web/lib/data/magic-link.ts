/**
 * MagicLinkRepository accessor for the UI.
 *
 * Mirrors `getRepository()` env-gating: a zero-dependency in-memory fixture by
 * default (so local dev works with no AWS), or the real `@bench/data` DynamoDB
 * layer when `DATA_BACKEND=dynamodb` (GSI3 token lookup per ADR-0008).
 *
 * This is the only place the magic-link backend is chosen; actions/pages never
 * know which is in play. Shapes match
 * `packages/@bench/data/src/repository/magic-link-repository.ts`.
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
 * Resolve the active magic-link repository.
 *
 * - DATA_BACKEND=dynamodb → the real DynamoDB layer (ADR-0008). Requires
 *   BENCH_TABLE_NAME (and AWS creds in the runtime's environment/role).
 * - otherwise → an in-memory fixture on `globalThis`, so the UI runs locally
 *   with no AWS.
 */
export function getMagicLinkRepository(): MagicLinkRepository {
  if (instance) return instance;

  if (process.env.DATA_BACKEND === 'dynamodb') {
    const tableName = process.env.BENCH_TABLE_NAME;
    if (!tableName) {
      throw new Error('BENCH_TABLE_NAME is required when DATA_BACKEND=dynamodb');
    }
    instance = createDynamoMagicLinkRepository(tableName, process.env.AWS_REGION);
  } else {
    instance = createFixtureMagicLinkRepository();
  }

  return instance;
}

/**
 * DynamoDB-backed magic-link repository — thin adapter over `@bench/data`.
 * The wrapped repo already exposes `create` and `lookupByTokenHash` in the exact
 * shapes above, so this just narrows the surface the UI depends on.
 */
function createDynamoMagicLinkRepository(
  tableName: string,
  region: string | undefined,
): MagicLinkRepository {
  // Dynamic import at runtime keeps `@aws-sdk/*` out of the local-dev bundle
  // when DATA_BACKEND is unset, matching the profile-repository seam.
  const benchData = require('@bench/data') as typeof import('@bench/data');
  const { createClient, createMagicLinkRepository } = benchData;

  const repo = createMagicLinkRepository(
    createClient(region ? { region } : undefined),
    tableName,
  );

  return {
    create: (tenantId, input) => repo.create(tenantId, input),
    lookupByTokenHash: (tokenHash) => repo.lookupByTokenHash(tokenHash),
    findById: (tenantId, profileId, linkId) => repo.findById(tenantId, profileId, linkId),
    markAsUsed: (tenantId, profileId, linkId) => repo.markAsUsed(tenantId, profileId, linkId),
  };
}

/**
 * In-memory fixture store, kept on `globalThis` so it survives the per-request
 * module re-evaluation in Next dev. Token hashes map straight to the full link;
 * links default to 'active'. No expiry sweep — callers validate `expiresAt`.
 *
 * `byHash` holds the full `MagicLink` (incl. `createdBy`) so the fixture can back
 * `findById` and `markAsUsed`. `idIndex` maps `tenantId|profileId|linkId` → the
 * token hash, so id-keyed reads/updates don't have to scan.
 */
interface FixtureStore {
  byHash: Map<string, MagicLink>;
  idIndex: Map<string, string>;
}

function idKey(tenantId: string, profileId: string, linkId: string): string {
  return `${tenantId}|${profileId}|${linkId}`;
}

function fixtureStore(): FixtureStore {
  const g = globalThis as typeof globalThis & {
    __benchMagicLinks__?: FixtureStore;
  };
  if (!g.__benchMagicLinks__) {
    g.__benchMagicLinks__ = { byHash: new Map(), idIndex: new Map() };
  }
  // Defensive: an older store shape (pre-idIndex) may linger on globalThis
  // across a hot reload; backfill the index so id-keyed ops keep working.
  if (!g.__benchMagicLinks__.idIndex) {
    g.__benchMagicLinks__.idIndex = new Map();
    for (const [hash, link] of g.__benchMagicLinks__.byHash) {
      g.__benchMagicLinks__.idIndex.set(
        idKey(link.tenantId, link.profileId, link.id),
        hash,
      );
    }
  }
  return g.__benchMagicLinks__;
}

function createFixtureMagicLinkRepository(): MagicLinkRepository {
  return {
    async create(tenantId, input) {
      const store = fixtureStore();
      const now = new Date().toISOString();
      store.byHash.set(input.tokenHash, {
        id: input.id,
        tenantId,
        profileId: input.profileId,
        type: input.type,
        scope: input.scope,
        status: 'active',
        passcodeHash: input.passcodeHash ?? null,
        expiresAt: input.expiresAt,
        createdAt: now,
        createdBy: input.createdBy,
        updatedAt: now,
      });
      store.idIndex.set(idKey(tenantId, input.profileId, input.id), input.tokenHash);
      return { id: input.id };
    },
    async lookupByTokenHash(tokenHash) {
      return fixtureStore().byHash.get(tokenHash) ?? null;
    },
    async findById(tenantId, profileId, linkId) {
      const store = fixtureStore();
      const hash = store.idIndex.get(idKey(tenantId, profileId, linkId));
      if (!hash) return null;
      const link = store.byHash.get(hash);
      if (!link || link.tenantId !== tenantId) return null;
      return link;
    },
    async markAsUsed(tenantId, profileId, linkId) {
      const store = fixtureStore();
      const hash = store.idIndex.get(idKey(tenantId, profileId, linkId));
      if (!hash) return;
      const link = store.byHash.get(hash);
      if (!link || link.tenantId !== tenantId) return;
      store.byHash.set(hash, {
        ...link,
        status: 'used',
        updatedAt: new Date().toISOString(),
      });
    },
  };
}

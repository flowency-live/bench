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

/** The slice of the magic-link contract the UI needs (create + token lookup). */
export interface MagicLinkRepository {
  create(tenantId: string, input: CreateMagicLinkInput): Promise<{ id: string }>;
  lookupByTokenHash(tokenHash: string): Promise<MagicLinkLookup | null>;
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
  // Lazy require keeps `@aws-sdk/*` out of the local-dev bundle when DATA_BACKEND
  // is unset (the fixture path), matching the profile-repository seam.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient, createMagicLinkRepository } = require('@bench/data') as typeof import('@bench/data');

  const repo = createMagicLinkRepository(
    createClient(region ? { region } : undefined),
    tableName,
  );

  return {
    create: (tenantId, input) => repo.create(tenantId, input),
    lookupByTokenHash: (tokenHash) => repo.lookupByTokenHash(tokenHash),
  };
}

/**
 * In-memory fixture store, kept on `globalThis` so it survives the per-request
 * module re-evaluation in Next dev. Token hashes map straight to lookups; links
 * default to 'active'. No expiry sweep — callers validate `expiresAt`.
 */
interface FixtureStore {
  byHash: Map<string, MagicLinkLookup>;
}

function fixtureStore(): FixtureStore {
  const g = globalThis as typeof globalThis & {
    __benchMagicLinks__?: FixtureStore;
  };
  if (!g.__benchMagicLinks__) {
    g.__benchMagicLinks__ = { byHash: new Map() };
  }
  return g.__benchMagicLinks__;
}

function createFixtureMagicLinkRepository(): MagicLinkRepository {
  return {
    async create(tenantId, input) {
      const store = fixtureStore();
      store.byHash.set(input.tokenHash, {
        id: input.id,
        tenantId,
        profileId: input.profileId,
        type: input.type,
        scope: input.scope,
        status: 'active',
        passcodeHash: input.passcodeHash ?? null,
        expiresAt: input.expiresAt,
        createdAt: new Date().toISOString(),
      });
      return { id: input.id };
    },
    async lookupByTokenHash(tokenHash) {
      return fixtureStore().byHash.get(tokenHash) ?? null;
    },
  };
}

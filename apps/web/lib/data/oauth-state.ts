/**
 * OAuth State Store — CSRF protection for OAuth flows (ADR-0012).
 *
 * Stores short-lived state tokens for OAuth authorization flows. Each token is
 * single-use and expires after 5 minutes. The state binds the authorization
 * request to the callback, preventing CSRF attacks.
 *
 * Storage pattern (DynamoDB):
 *   PK: OAUTH#state#{token}
 *   SK: OAUTH#state#{token}
 *   TTL: now + 300 seconds
 *   origin: request origin URL
 *   createdAt: ISO8601
 */

import { randomBytes } from 'node:crypto';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

/** State data stored with each OAuth state token. */
export interface OAuthStateData {
  readonly origin: string;
  readonly createdAt: string;
}

/** OAuth state store interface. */
export interface OAuthStateStore {
  /** Create a new state token and return it. */
  create(origin: string): Promise<string>;
  /** Verify and consume a state token. Returns null if invalid/expired/used. */
  verify(state: string): Promise<OAuthStateData | null>;
}

let instance: OAuthStateStore | null = null;

/**
 * Reset the singleton instance (for testing only).
 * @internal
 */
export function _resetOAuthStateStoreInstance(): void {
  instance = null;
  // Also reset the fixture store
  const g = globalThis as typeof globalThis & {
    __benchOAuthStates__?: FixtureStore;
  };
  delete g.__benchOAuthStates__;
}

/**
 * Resolve the active OAuth state store.
 *
 * - DATA_BACKEND=dynamodb -> DynamoDB store with TTL
 * - otherwise -> in-memory fixture store
 */
export function getOAuthStateStore(): OAuthStateStore {
  if (instance) return instance;

  if (process.env.DATA_BACKEND === 'dynamodb') {
    const tableName = process.env.BENCH_TABLE_NAME;
    if (!tableName) {
      throw new Error('BENCH_TABLE_NAME is required when DATA_BACKEND=dynamodb');
    }
    instance = createDynamoOAuthStateStore(tableName, process.env.AWS_REGION);
  } else {
    instance = createFixtureOAuthStateStore();
  }

  return instance;
}

/** State TTL in seconds (5 minutes). */
const STATE_TTL_SECONDS = 300;

/**
 * DynamoDB-backed OAuth state store.
 *
 * Uses bench-main table with OAUTH#state#{token} as PK/SK.
 * TTL enables automatic cleanup of expired tokens.
 */
function createDynamoOAuthStateStore(
  tableName: string,
  region: string | undefined,
): OAuthStateStore {
  const client = new DynamoDBClient({ region: region ?? 'eu-west-2' });

  return {
    async create(origin: string): Promise<string> {
      const token = randomBytes(32).toString('base64url');
      const now = Date.now();
      const ttl = Math.floor(now / 1000) + STATE_TTL_SECONDS;
      const key = `OAUTH#state#${token}`;

      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            PK: { S: key },
            SK: { S: key },
            origin: { S: origin },
            ttl: { N: String(ttl) },
            createdAt: { S: new Date(now).toISOString() },
          },
        }),
      );

      return token;
    },

    async verify(state: string): Promise<OAuthStateData | null> {
      const key = `OAUTH#state#${state}`;

      // Get the state item
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: {
            PK: { S: key },
            SK: { S: key },
          },
        }),
      );

      if (!result.Item) {
        return null;
      }

      // Check if expired (TTL is in seconds)
      const ttl = result.Item.ttl?.N ? parseInt(result.Item.ttl.N, 10) : 0;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds > ttl) {
        // Expired - DynamoDB TTL may not have cleaned it up yet
        return null;
      }

      const origin = result.Item.origin?.S;
      const createdAt = result.Item.createdAt?.S;

      if (!origin || !createdAt) {
        return null;
      }

      // Single-use: delete the token
      await client.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: {
            PK: { S: key },
            SK: { S: key },
          },
        }),
      );

      return { origin, createdAt };
    },
  };
}

/**
 * In-memory fixture store for OAuth state tokens.
 */
interface FixtureStore {
  states: Map<string, { data: OAuthStateData; expiresAt: number }>;
}

function fixtureStore(): FixtureStore {
  const g = globalThis as typeof globalThis & {
    __benchOAuthStates__?: FixtureStore;
  };
  if (!g.__benchOAuthStates__) {
    g.__benchOAuthStates__ = { states: new Map() };
  }
  return g.__benchOAuthStates__;
}

function createFixtureOAuthStateStore(): OAuthStateStore {
  return {
    async create(origin: string): Promise<string> {
      const store = fixtureStore();
      // Generate a cryptographically random state token
      const state = randomBytes(32).toString('base64url');
      const now = Date.now();
      const data: OAuthStateData = {
        origin,
        createdAt: new Date(now).toISOString(),
      };
      store.states.set(state, {
        data,
        expiresAt: now + STATE_TTL_SECONDS * 1000,
      });
      return state;
    },

    async verify(state: string): Promise<OAuthStateData | null> {
      const store = fixtureStore();
      const entry = store.states.get(state);

      if (!entry) {
        return null;
      }

      // Check expiry
      if (Date.now() > entry.expiresAt) {
        store.states.delete(state);
        return null;
      }

      // Single-use: delete after verification
      store.states.delete(state);
      return entry.data;
    },
  };
}

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

/** State TTL in seconds (5 minutes). */
const STATE_TTL_SECONDS = 300;

/**
 * Get the DynamoDB OAuth state store.
 */
export function getOAuthStateStore(): OAuthStateStore {
  if (instance) return instance;

  const tableName = process.env.BENCH_TABLE_NAME ?? 'bench-main';
  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });

  instance = {
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

  return instance;
}

/**
 * Magic link repository - DynamoDB implementation
 *
 * Provides data access for magic links:
 * - Token lookup via GSI3 (cross-tenant, returns tenant context)
 * - CRUD operations within tenant context
 *
 * Per ADR-0008: GSI3 (TOKENHASH#{hash}) resolves a magic-link token to its item
 * — which carries tenantId — to establish the scoped session.
 */
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  profilePK,
  magicLinkSK,
  tokenHashGSI3PK,
  validateTenantId,
} from '../keys.js';

/**
 * Magic link type
 */
export type MagicLinkType = 'invite' | 'share';

/**
 * Magic link scope
 */
export type MagicLinkScope = 'edit' | 'view';

/**
 * Magic link status
 */
export type MagicLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

/**
 * Magic link lookup result (from GSI3 query)
 */
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

/**
 * Full magic link entity
 */
export interface MagicLink extends MagicLinkLookup {
  readonly createdBy: string;
  readonly updatedAt: string;
}

/**
 * Create magic link input
 */
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

/**
 * Magic link repository interface
 */
export interface MagicLinkRepository {
  /**
   * Look up a magic link by token hash (cross-tenant, no context needed).
   * Uses GSI3 to find the link by its token hash.
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
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID (link is stored under profile)
   * @param linkId - Magic link UUID
   * @returns Magic link or null if not found
   */
  findById(tenantId: string, profileId: string, linkId: string): Promise<MagicLink | null>;

  /**
   * Create a new magic link.
   *
   * @param tenantId - Tenant ID
   * @param input - Magic link creation input
   * @returns Created magic link
   */
  create(tenantId: string, input: CreateMagicLinkInput): Promise<MagicLink>;

  /**
   * Mark a magic link as used.
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID
   * @param linkId - Magic link UUID
   */
  markAsUsed(tenantId: string, profileId: string, linkId: string): Promise<void>;

  /**
   * Mark a magic link as revoked.
   *
   * @param tenantId - Tenant ID
   * @param profileId - Profile ID
   * @param linkId - Magic link UUID
   */
  markAsRevoked(tenantId: string, profileId: string, linkId: string): Promise<void>;
}

/**
 * DynamoDB item shape for magic links
 */
interface MagicLinkItem {
  PK: string;
  SK: string;
  GSI3PK: string;
  GSI3SK: string;
  entityType: 'MAGIC_LINK';
  id: string;
  tenantId: string;
  profileId: string;
  type: MagicLinkType;
  scope: MagicLinkScope;
  status: MagicLinkStatus;
  tokenHash: string;
  passcodeHash: string | null;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  TTL?: number;
}

function itemToLookup(item: MagicLinkItem): MagicLinkLookup {
  return {
    id: item.id,
    tenantId: item.tenantId,
    profileId: item.profileId,
    type: item.type,
    scope: item.scope,
    status: item.status,
    passcodeHash: item.passcodeHash,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
  };
}

function itemToMagicLink(item: MagicLinkItem): MagicLink {
  return {
    ...itemToLookup(item),
    createdBy: item.createdBy,
    updatedAt: item.updatedAt,
  };
}

/**
 * Create a magic link repository.
 *
 * @param client - DynamoDB Document client
 * @param tableName - DynamoDB table name
 * @returns MagicLinkRepository instance
 */
export function createMagicLinkRepository(
  client: DynamoDBDocumentClient,
  tableName: string
): MagicLinkRepository {
  return {
    async lookupByTokenHash(tokenHash: string): Promise<MagicLinkLookup | null> {
      // GSI3 lookup - no tenant context required
      // This is the ONE global lookup per ADR-0008
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI3',
          KeyConditionExpression: 'GSI3PK = :pk',
          ExpressionAttributeValues: {
            ':pk': tokenHashGSI3PK(tokenHash),
          },
          Limit: 1,
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = result.Items[0] as MagicLinkItem;
      return itemToLookup(item);
    },

    async findById(
      tenantId: string,
      profileId: string,
      linkId: string
    ): Promise<MagicLink | null> {
      validateTenantId(tenantId);

      // Query by PK and filter by linkId since SK includes type which we don't know
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          FilterExpression: 'id = :linkId',
          ExpressionAttributeValues: {
            ':pk': profilePK(tenantId, profileId),
            ':skPrefix': 'LINK#',
            ':linkId': linkId,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = result.Items[0] as MagicLinkItem;

      // Double-check tenant isolation (defense in depth)
      if (item.tenantId !== tenantId) {
        return null;
      }

      return itemToMagicLink(item);
    },

    async create(tenantId: string, input: CreateMagicLinkInput): Promise<MagicLink> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();
      const expiresAtDate = new Date(input.expiresAt);
      const ttl = Math.floor(expiresAtDate.getTime() / 1000);

      const item: MagicLinkItem = {
        PK: profilePK(tenantId, input.profileId),
        SK: magicLinkSK(input.type, input.id),
        GSI3PK: tokenHashGSI3PK(input.tokenHash),
        GSI3SK: input.id,
        entityType: 'MAGIC_LINK',
        id: input.id,
        tenantId,
        profileId: input.profileId,
        type: input.type,
        scope: input.scope,
        status: 'active',
        tokenHash: input.tokenHash,
        passcodeHash: input.passcodeHash ?? null,
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        TTL: ttl,
      };

      await client.send(new PutCommand({ TableName: tableName, Item: item }));

      return itemToMagicLink(item);
    },

    async markAsUsed(tenantId: string, profileId: string, linkId: string): Promise<void> {
      validateTenantId(tenantId);
      await updateStatus(client, tableName, tenantId, profileId, linkId, 'used');
    },

    async markAsRevoked(tenantId: string, profileId: string, linkId: string): Promise<void> {
      validateTenantId(tenantId);
      await updateStatus(client, tableName, tenantId, profileId, linkId, 'revoked');
    },
  };
}

async function updateStatus(
  client: DynamoDBDocumentClient,
  tableName: string,
  tenantId: string,
  profileId: string,
  linkId: string,
  status: MagicLinkStatus
): Promise<void> {
  const now = new Date().toISOString();

  // We need to find the link first to get the type (for SK)
  // Query by profile PK and filter by linkId
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'id = :linkId',
      ExpressionAttributeValues: {
        ':pk': profilePK(tenantId, profileId),
        ':skPrefix': 'LINK#',
        ':linkId': linkId,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return; // Link not found, nothing to update
  }

  const item = result.Items[0] as MagicLinkItem;

  // Verify tenant isolation
  if (item.tenantId !== tenantId) {
    return;
  }

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: item.PK,
        SK: item.SK,
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': now,
        ':tenantId': tenantId,
      },
      ConditionExpression: 'attribute_exists(PK) AND tenantId = :tenantId',
    })
  );
}

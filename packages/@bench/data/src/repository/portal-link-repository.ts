/**
 * Portal link repository - DynamoDB implementation
 *
 * Provides data access for client portal magic links:
 * - Token lookup via GSI3 (cross-tenant, returns tenant + client context)
 * - CRUD operations within tenant/client context
 *
 * Per ADR-0008: GSI3 (TOKENHASH#{hash}) resolves a magic-link token to its item
 * — which carries tenantId and clientId — to establish the scoped session.
 *
 * Key pattern:
 * - PK: TENANT#{tenantId}#CLIENT#{clientId}
 * - SK: LINK#portal#{linkId}
 * - GSI3PK: TOKENHASH#{hash}
 */
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  clientPK,
  clientMagicLinkSK,
  tokenHashGSI3PK,
  validateTenantId,
} from '../keys.js';

/**
 * Portal link status
 */
export type PortalLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

/**
 * Portal link lookup result (from GSI3 query)
 */
export interface PortalLinkLookup {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly contactId: string;
  readonly contactEmail: string;
  readonly status: PortalLinkStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

/**
 * Full portal link entity
 */
export interface PortalLink extends PortalLinkLookup {
  readonly createdBy: string;
  readonly updatedAt: string;
}

/**
 * Create portal link input
 */
export interface CreatePortalLinkInput {
  readonly contactId: string;
  readonly contactEmail: string;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly createdBy: string;
}

/**
 * Portal link repository interface
 */
export interface PortalLinkRepository {
  /**
   * Look up a portal link by token hash (cross-tenant, no context needed).
   * Uses GSI3 to find the link by its token hash.
   *
   * This is the entry point for validating a portal link token.
   * Returns tenant and client info so caller can establish session.
   *
   * @param tokenHash - SHA-256 hash of the token
   * @returns Portal link lookup result or null if not found
   */
  lookupByTokenHash(tokenHash: string): Promise<PortalLinkLookup | null>;

  /**
   * Create a new portal link for a client contact.
   *
   * @param tenantId - Tenant ID
   * @param clientId - Client ID
   * @param input - Portal link creation input
   * @returns Created portal link
   */
  create(tenantId: string, clientId: string, input: CreatePortalLinkInput): Promise<PortalLink>;

  /**
   * Mark a portal link as used (single-use enforcement).
   */
  markAsUsed(tenantId: string, clientId: string, linkId: string): Promise<void>;

  /**
   * Mark a portal link as revoked.
   */
  markAsRevoked(tenantId: string, clientId: string, linkId: string): Promise<void>;

  /**
   * List all portal links for a client.
   */
  listByClient(tenantId: string, clientId: string): Promise<readonly PortalLink[]>;
}

/**
 * DynamoDB item shape for portal links
 */
interface PortalLinkItem {
  PK: string;
  SK: string;
  GSI3PK: string;
  GSI3SK: string;
  entityType: 'PORTAL_LINK';
  id: string;
  tenantId: string;
  clientId: string;
  contactId: string;
  contactEmail: string;
  tokenHash: string;
  status: PortalLinkStatus;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  TTL?: number;
}

function generateLinkId(): string {
  return `plink-${crypto.randomUUID()}`;
}

function itemToLookup(item: PortalLinkItem): PortalLinkLookup {
  return {
    id: item.id,
    tenantId: item.tenantId,
    clientId: item.clientId,
    contactId: item.contactId,
    contactEmail: item.contactEmail,
    status: item.status,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
  };
}

function itemToPortalLink(item: PortalLinkItem): PortalLink {
  return {
    ...itemToLookup(item),
    createdBy: item.createdBy,
    updatedAt: item.updatedAt,
  };
}

/**
 * Create a portal link repository.
 */
export function createPortalLinkRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): PortalLinkRepository {
  return {
    async lookupByTokenHash(tokenHash: string): Promise<PortalLinkLookup | null> {
      // GSI3 lookup - no tenant context required
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI3',
          KeyConditionExpression: 'GSI3PK = :pk',
          ExpressionAttributeValues: {
            ':pk': tokenHashGSI3PK(tokenHash),
          },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const item = result.Items[0] as PortalLinkItem;

      // Verify this is a portal link (GSI3 is shared with other link types)
      if (item.entityType !== 'PORTAL_LINK') {
        return null;
      }

      return itemToLookup(item);
    },

    async create(
      tenantId: string,
      clientId: string,
      input: CreatePortalLinkInput,
    ): Promise<PortalLink> {
      validateTenantId(tenantId);

      const id = generateLinkId();
      const now = new Date().toISOString();
      const expiresAtDate = new Date(input.expiresAt);
      const ttl = Math.floor(expiresAtDate.getTime() / 1000);

      const item: PortalLinkItem = {
        PK: clientPK(tenantId, clientId),
        SK: clientMagicLinkSK(id),
        GSI3PK: tokenHashGSI3PK(input.tokenHash),
        GSI3SK: id,
        entityType: 'PORTAL_LINK',
        id,
        tenantId,
        clientId,
        contactId: input.contactId,
        contactEmail: input.contactEmail,
        tokenHash: input.tokenHash,
        status: 'active',
        expiresAt: input.expiresAt,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        TTL: ttl,
      };

      await client.send(new PutCommand({ TableName: tableName, Item: item }));

      return itemToPortalLink(item);
    },

    async markAsUsed(tenantId: string, clientId: string, linkId: string): Promise<void> {
      validateTenantId(tenantId);
      await updateStatus(client, tableName, tenantId, clientId, linkId, 'used');
    },

    async markAsRevoked(tenantId: string, clientId: string, linkId: string): Promise<void> {
      validateTenantId(tenantId);
      await updateStatus(client, tableName, tenantId, clientId, linkId, 'revoked');
    },

    async listByClient(tenantId: string, clientId: string): Promise<readonly PortalLink[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': clientPK(tenantId, clientId),
            ':skPrefix': 'LINK#portal#',
          },
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.filter((item) => (item as PortalLinkItem).entityType === 'PORTAL_LINK')
        .map((item) => itemToPortalLink(item as PortalLinkItem));
    },
  };
}

async function updateStatus(
  client: DynamoDBDocumentClient,
  tableName: string,
  tenantId: string,
  clientId: string,
  linkId: string,
  status: PortalLinkStatus,
): Promise<void> {
  const now = new Date().toISOString();

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: clientPK(tenantId, clientId),
        SK: clientMagicLinkSK(linkId),
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
    }),
  );
}

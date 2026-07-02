/**
 * ClientRepository — DynamoDB implementation.
 *
 * Clients are tenant-scoped items keyed `TENANT#{tenantId}#CLIENT#{clientId}`.
 * Each client represents an external company who can access the portal.
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Client,
  ClientVisibilityMode,
  CreateClientInput,
  UpdateClientInput,
} from '@bench/types';
import { tenantPK, clientPK, clientSK, validateTenantId } from '../keys.js';

/**
 * DynamoDB item shape for a Client.
 */
interface ClientItem {
  PK: string;
  SK: string;
  entityType: 'CLIENT';
  id: string;
  tenantId: string;
  companyName: string;
  visibilityMode: ClientVisibilityMode;
  handpickedProfileIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * DynamoDB item shape for a Client listing (for listByTenant).
 */
interface ClientListingItem {
  PK: string;
  SK: string;
  entityType: 'CLIENT_LISTING';
  id: string;
  tenantId: string;
  companyName: string;
  visibilityMode: ClientVisibilityMode;
  createdAt: string;
}

/**
 * Generate a unique client ID.
 */
function generateClientId(): string {
  return `client-${crypto.randomUUID()}`;
}

/**
 * Map a DynamoDB item to a Client domain object.
 */
function itemToClient(item: ClientItem | ClientListingItem): Client {
  const handpickedProfileIds =
    'handpickedProfileIds' in item ? item.handpickedProfileIds : [];
  const updatedAt = 'updatedAt' in item ? item.updatedAt : item.createdAt;
  const createdBy = 'createdBy' in item ? item.createdBy : '';

  return {
    id: item.id,
    tenantId: item.tenantId,
    companyName: item.companyName,
    visibilityMode: item.visibilityMode,
    handpickedProfileIds,
    createdAt: item.createdAt,
    updatedAt,
    createdBy,
  };
}

/**
 * Client repository interface.
 */
export interface ClientRepository {
  create(tenantId: string, input: CreateClientInput): Promise<Client>;
  get(tenantId: string, clientId: string): Promise<Client | null>;
  listByTenant(tenantId: string): Promise<readonly Client[]>;
  update(tenantId: string, clientId: string, input: UpdateClientInput): Promise<Client>;
  remove(tenantId: string, clientId: string): Promise<void>;
}

/**
 * Create a ClientRepository backed by DynamoDB.
 */
export function createClientRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): ClientRepository {
  /**
   * Get a client by tenantId and clientId with defense-in-depth check.
   */
  async function getClientItem(
    tenantId: string,
    clientId: string,
  ): Promise<ClientItem | null> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: clientPK(tenantId, clientId),
          SK: clientSK(clientId),
        },
      }),
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item as ClientItem;

    // Defense in depth: verify tenant ownership
    if (item.tenantId !== tenantId) {
      return null;
    }

    return item;
  }

  return {
    /**
     * Create a new client.
     */
    async create(tenantId: string, input: CreateClientInput): Promise<Client> {
      validateTenantId(tenantId);

      const id = generateClientId();
      const now = new Date().toISOString();
      const companyName = input.companyName.trim();

      const clientItem: ClientItem = {
        PK: clientPK(tenantId, id),
        SK: clientSK(id),
        entityType: 'CLIENT',
        id,
        tenantId,
        companyName,
        visibilityMode: input.visibilityMode,
        handpickedProfileIds: input.handpickedProfileIds ?? [],
        createdAt: now,
        updatedAt: now,
        createdBy: input.createdBy,
      };

      const listingItem: ClientListingItem = {
        PK: tenantPK(tenantId),
        SK: clientSK(id),
        entityType: 'CLIENT_LISTING',
        id,
        tenantId,
        companyName,
        visibilityMode: input.visibilityMode,
        createdAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: clientItem } },
            { Put: { TableName: tableName, Item: listingItem } },
          ],
        }),
      );

      return itemToClient(clientItem);
    },

    /**
     * Get a client by ID.
     */
    async get(tenantId: string, clientId: string): Promise<Client | null> {
      validateTenantId(tenantId);

      const item = await getClientItem(tenantId, clientId);
      if (!item) {
        return null;
      }

      return itemToClient(item);
    },

    /**
     * List all clients for a tenant, sorted by company name.
     */
    async listByTenant(tenantId: string): Promise<readonly Client[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': tenantPK(tenantId),
            ':skPrefix': 'CLIENT#',
          },
        }),
      );

      const items = (result.Items ?? []) as ClientListingItem[];
      const clients = items
        .filter((item) => item.entityType === 'CLIENT_LISTING')
        .map(itemToClient);

      // Sort by company name
      return clients.sort((a, b) => a.companyName.localeCompare(b.companyName));
    },

    /**
     * Update a client.
     */
    async update(
      tenantId: string,
      clientId: string,
      input: UpdateClientInput,
    ): Promise<Client> {
      validateTenantId(tenantId);

      const existing = await getClientItem(tenantId, clientId);
      if (!existing) {
        throw new Error('Client not found');
      }

      const now = new Date().toISOString();
      const companyName = input.companyName?.trim() ?? existing.companyName;
      const visibilityMode = input.visibilityMode ?? existing.visibilityMode;
      const handpickedProfileIds =
        input.handpickedProfileIds ?? existing.handpickedProfileIds;

      const updatedItem: ClientItem = {
        ...existing,
        companyName,
        visibilityMode,
        handpickedProfileIds,
        updatedAt: now,
      };

      const listingItem: ClientListingItem = {
        PK: tenantPK(tenantId),
        SK: clientSK(clientId),
        entityType: 'CLIENT_LISTING',
        id: existing.id,
        tenantId: existing.tenantId,
        companyName,
        visibilityMode,
        createdAt: existing.createdAt,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: updatedItem } },
            { Put: { TableName: tableName, Item: listingItem } },
          ],
        }),
      );

      return itemToClient(updatedItem);
    },

    /**
     * Remove a client.
     */
    async remove(tenantId: string, clientId: string): Promise<void> {
      validateTenantId(tenantId);

      const existing = await getClientItem(tenantId, clientId);
      if (!existing) {
        throw new Error('Client not found');
      }

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: clientPK(tenantId, clientId),
                  SK: clientSK(clientId),
                },
              },
            },
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: tenantPK(tenantId),
                  SK: clientSK(clientId),
                },
              },
            },
          ],
        }),
      );
    },
  };
}

/**
 * ClientContactRepository — DynamoDB implementation.
 *
 * ClientContacts are scoped to a client within a tenant:
 * PK = TENANT#{tenantId}#CLIENT#{clientId}, SK = CONTACT#{contactId}
 *
 * GSI1 provides global email lookup for magic link validation:
 * GSI1PK = EMAIL#{email}, GSI1SK = CONTACT#{contactId}
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ClientContact,
  CreateClientContactInput,
  UpdateClientContactInput,
} from '@bench/types';
import { clientPK, contactSK, emailGSI1PK, validateTenantId } from '../keys.js';

/**
 * DynamoDB item shape for a ClientContact.
 */
interface ClientContactItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'CLIENT_CONTACT';
  id: string;
  tenantId: string;
  clientId: string;
  email: string;
  name: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a unique contact ID.
 */
function generateContactId(): string {
  return `contact-${crypto.randomUUID()}`;
}

/**
 * Map a DynamoDB item to a ClientContact domain object.
 */
function itemToContact(item: ClientContactItem): ClientContact {
  return {
    id: item.id,
    tenantId: item.tenantId,
    clientId: item.clientId,
    email: item.email,
    name: item.name,
    lastLoginAt: item.lastLoginAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * ClientContact repository interface.
 */
export interface ClientContactRepository {
  create(
    tenantId: string,
    clientId: string,
    input: CreateClientContactInput,
  ): Promise<ClientContact>;
  get(
    tenantId: string,
    clientId: string,
    contactId: string,
  ): Promise<ClientContact | null>;
  /** Global lookup by email via GSI1 (for magic link validation). */
  getByEmail(email: string): Promise<ClientContact | null>;
  listByClient(tenantId: string, clientId: string): Promise<readonly ClientContact[]>;
  update(
    tenantId: string,
    clientId: string,
    contactId: string,
    input: UpdateClientContactInput,
  ): Promise<ClientContact>;
  /** Update last login timestamp (called when contact uses magic link). */
  updateLastLogin(
    tenantId: string,
    clientId: string,
    contactId: string,
  ): Promise<ClientContact>;
  remove(tenantId: string, clientId: string, contactId: string): Promise<void>;
}

/**
 * Create a ClientContactRepository backed by DynamoDB.
 */
export function createClientContactRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): ClientContactRepository {
  /**
   * Get a contact by tenantId, clientId, and contactId with defense-in-depth check.
   */
  async function getContactItem(
    tenantId: string,
    clientId: string,
    contactId: string,
  ): Promise<ClientContactItem | null> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: clientPK(tenantId, clientId),
          SK: contactSK(contactId),
        },
      }),
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item as ClientContactItem;

    // Defense in depth: verify tenant ownership
    if (item.tenantId !== tenantId) {
      return null;
    }

    return item;
  }

  return {
    /**
     * Create a new client contact.
     */
    async create(
      tenantId: string,
      clientId: string,
      input: CreateClientContactInput,
    ): Promise<ClientContact> {
      validateTenantId(tenantId);

      const id = generateContactId();
      const now = new Date().toISOString();
      const email = input.email.trim().toLowerCase();
      const name = input.name.trim();

      const contactItem: ClientContactItem = {
        PK: clientPK(tenantId, clientId),
        SK: contactSK(id),
        GSI1PK: emailGSI1PK(email),
        GSI1SK: contactSK(id),
        entityType: 'CLIENT_CONTACT',
        id,
        tenantId,
        clientId,
        email,
        name,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [{ Put: { TableName: tableName, Item: contactItem } }],
        }),
      );

      return itemToContact(contactItem);
    },

    /**
     * Get a contact by ID.
     */
    async get(
      tenantId: string,
      clientId: string,
      contactId: string,
    ): Promise<ClientContact | null> {
      validateTenantId(tenantId);

      const item = await getContactItem(tenantId, clientId, contactId);
      if (!item) {
        return null;
      }

      return itemToContact(item);
    },

    /**
     * Global lookup by email via GSI1 (for magic link validation).
     */
    async getByEmail(email: string): Promise<ClientContact | null> {
      const normalizedEmail = email.trim().toLowerCase();

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': emailGSI1PK(normalizedEmail),
          },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      // Filter for CLIENT_CONTACT entityType (GSI1 is shared with USER)
      const contactItem = result.Items.find(
        (item) => item.entityType === 'CLIENT_CONTACT',
      ) as ClientContactItem | undefined;

      if (!contactItem) {
        return null;
      }

      return itemToContact(contactItem);
    },

    /**
     * List all contacts for a client, sorted by name.
     */
    async listByClient(
      tenantId: string,
      clientId: string,
    ): Promise<readonly ClientContact[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': clientPK(tenantId, clientId),
            ':skPrefix': 'CONTACT#',
          },
        }),
      );

      const items = (result.Items ?? []) as ClientContactItem[];
      const contacts = items
        .filter((item) => item.entityType === 'CLIENT_CONTACT')
        .map(itemToContact);

      // Sort by name
      return contacts.sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Update last login timestamp.
     */
    async updateLastLogin(
      tenantId: string,
      clientId: string,
      contactId: string,
    ): Promise<ClientContact> {
      validateTenantId(tenantId);

      const now = new Date().toISOString();

      const result = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: clientPK(tenantId, clientId),
            SK: contactSK(contactId),
          },
          UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      return itemToContact(result.Attributes as ClientContactItem);
    },

    /**
     * Update a contact.
     */
    async update(
      tenantId: string,
      clientId: string,
      contactId: string,
      input: UpdateClientContactInput,
    ): Promise<ClientContact> {
      validateTenantId(tenantId);

      const existing = await getContactItem(tenantId, clientId, contactId);
      if (!existing) {
        throw new Error('Contact not found');
      }

      const now = new Date().toISOString();
      const email = input.email?.trim().toLowerCase() ?? existing.email;
      const name = input.name?.trim() ?? existing.name;

      const updatedItem: ClientContactItem = {
        ...existing,
        email,
        name,
        // Update GSI1 keys if email changed
        GSI1PK: emailGSI1PK(email),
        updatedAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [{ Put: { TableName: tableName, Item: updatedItem } }],
        }),
      );

      return itemToContact(updatedItem);
    },

    /**
     * Remove a contact.
     */
    async remove(
      tenantId: string,
      clientId: string,
      contactId: string,
    ): Promise<void> {
      validateTenantId(tenantId);

      const existing = await getContactItem(tenantId, clientId, contactId);
      if (!existing) {
        throw new Error('Contact not found');
      }

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: clientPK(tenantId, clientId),
                  SK: contactSK(contactId),
                },
              },
            },
          ],
        }),
      );
    },
  };
}

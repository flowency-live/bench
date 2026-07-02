/**
 * ClientActivityRepository — DynamoDB implementation.
 *
 * Activity events are stored under the client for efficient querying:
 * PK = TENANT#{tenantId}#CLIENT#{clientId}
 * SK = ACTIVITY#{timestamp}#{eventId}
 *
 * This allows listing all activity for a client in chronological order.
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ClientActivity,
  ClientActivityEventType,
  LogClientActivityInput,
} from '@bench/types';
import { clientPK, clientActivitySK, validateTenantId } from '../keys.js';

/**
 * DynamoDB item shape for a ClientActivity event.
 */
interface ClientActivityItem {
  PK: string;
  SK: string;
  entityType: 'CLIENT_ACTIVITY';
  id: string;
  tenantId: string;
  clientId: string;
  contactId: string;
  contactEmail: string;
  profileId: string;
  eventType: ClientActivityEventType;
  createdAt: string;
}

/**
 * Generate a unique activity ID.
 */
function generateActivityId(): string {
  return `activity-${crypto.randomUUID()}`;
}

/**
 * Map a DynamoDB item to a ClientActivity domain object.
 */
function itemToActivity(item: ClientActivityItem): ClientActivity {
  return {
    id: item.id,
    tenantId: item.tenantId,
    clientId: item.clientId,
    contactId: item.contactId,
    contactEmail: item.contactEmail,
    profileId: item.profileId,
    eventType: item.eventType,
    createdAt: item.createdAt,
  };
}

/**
 * Options for listing activity.
 */
export interface ListActivityOptions {
  limit?: number;
}

/**
 * ClientActivity repository interface.
 */
export interface ClientActivityRepository {
  /** Log an activity event. */
  log(tenantId: string, input: LogClientActivityInput): Promise<ClientActivity>;
  /** List activity for a client (newest first). */
  listByClient(
    tenantId: string,
    clientId: string,
    options?: ListActivityOptions,
  ): Promise<readonly ClientActivity[]>;
}

/**
 * Create a ClientActivityRepository backed by DynamoDB.
 */
export function createClientActivityRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): ClientActivityRepository {
  return {
    /**
     * Log an activity event.
     */
    async log(
      tenantId: string,
      input: LogClientActivityInput,
    ): Promise<ClientActivity> {
      validateTenantId(tenantId);

      const id = generateActivityId();
      const now = new Date();
      const createdAt = now.toISOString();

      const activityItem: ClientActivityItem = {
        PK: clientPK(tenantId, input.clientId),
        SK: clientActivitySK(now, id),
        entityType: 'CLIENT_ACTIVITY',
        id,
        tenantId,
        clientId: input.clientId,
        contactId: input.contactId,
        contactEmail: input.contactEmail,
        profileId: input.profileId,
        eventType: input.eventType,
        createdAt,
      };

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: activityItem,
        }),
      );

      return itemToActivity(activityItem);
    },

    /**
     * List activity for a client (newest first).
     */
    async listByClient(
      tenantId: string,
      clientId: string,
      options?: ListActivityOptions,
    ): Promise<readonly ClientActivity[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': clientPK(tenantId, clientId),
            ':skPrefix': 'ACTIVITY#',
          },
          ScanIndexForward: false, // Newest first
          Limit: options?.limit,
        }),
      );

      const items = (result.Items ?? []) as ClientActivityItem[];
      return items
        .filter((item) => item.entityType === 'CLIENT_ACTIVITY')
        .map(itemToActivity);
    },
  };
}

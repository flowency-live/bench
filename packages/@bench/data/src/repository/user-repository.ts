/**
 * UserRepository — DynamoDB implementation (ADR-0008, ADR-0010, ADR-0012).
 *
 * Users are tenant-scoped items keyed `TENANT#{tenantId}#USER#{userId}`.
 * `getByEmail` is a global lookup via GSI1 `EMAIL#{email}` — the only cross-tenant read.
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  TenantUser,
  TenantUserRole,
  TenantUserStatus,
  UserRepository,
  CreateTenantUserInput,
} from '@bench/types';
import { tenantPK, userPK, userSK, emailGSI1PK, validateTenantId } from '../keys.js';

/**
 * DynamoDB item shape for a User.
 */
interface UserItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'USER';
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: TenantUserRole;
  status: TenantUserStatus;
  cognitoId: string | null;
  invitedBy?: string;
  createdAt: string;
}

/**
 * DynamoDB item shape for a User listing (for listByTenant).
 * Includes createdAt so listByTenant returns real timestamps (CR1).
 */
interface UserListingItem {
  PK: string;
  SK: string;
  entityType: 'USER_LISTING';
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: TenantUserRole;
  status: TenantUserStatus;
  createdAt: string;
}

/**
 * Generate a unique user ID.
 */
function generateUserId(): string {
  return `user-${crypto.randomUUID()}`;
}

/**
 * Map a DynamoDB item to a TenantUser domain object.
 */
function itemToUser(item: UserItem | UserListingItem): TenantUser {
  const cognitoId = 'cognitoId' in item ? item.cognitoId : null;
  const invitedBy = 'invitedBy' in item ? item.invitedBy : undefined;

  return {
    id: item.id,
    tenantId: item.tenantId,
    email: item.email,
    name: item.name,
    role: item.role,
    status: item.status,
    cognitoId,
    invitedBy,
    createdAt: item.createdAt,
  };
}

/**
 * Create a UserRepository backed by DynamoDB.
 */
export function createUserRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): UserRepository {
  /**
   * Get a user by tenantId and userId with defense-in-depth check.
   */
  async function getUser(tenantId: string, userId: string): Promise<UserItem | null> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: userPK(tenantId, userId),
          SK: userSK(userId),
        },
      }),
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item as UserItem;

    // Defense in depth: verify tenant ownership
    if (item.tenantId !== tenantId) {
      return null;
    }

    return item;
  }

  return {
    /**
     * Create a new tenant user.
     * - Email normalized to lowercase
     * - Status starts as 'pending'
     * - cognitoId starts as null
     */
    async create(tenantId: string, input: CreateTenantUserInput): Promise<TenantUser> {
      validateTenantId(tenantId);

      const id = generateUserId();
      const now = new Date().toISOString();
      const email = input.email.trim().toLowerCase();

      const userItem: UserItem = {
        PK: userPK(tenantId, id),
        SK: userSK(id),
        GSI1PK: emailGSI1PK(email),
        GSI1SK: userSK(id),
        entityType: 'USER',
        id,
        tenantId,
        email,
        name: input.name?.trim(),
        role: input.role,
        status: 'pending',
        cognitoId: null,
        invitedBy: input.invitedBy?.trim().toLowerCase(),
        createdAt: now,
      };

      const listingItem: UserListingItem = {
        PK: tenantPK(tenantId),
        SK: userSK(id),
        entityType: 'USER_LISTING',
        id,
        tenantId,
        email,
        name: input.name?.trim(),
        role: input.role,
        status: 'pending',
        createdAt: now,
      };

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: tableName, Item: userItem } },
            { Put: { TableName: tableName, Item: listingItem } },
          ],
        }),
      );

      return itemToUser(userItem);
    },

    /**
     * Global lookup by email via GSI1 (the one cross-tenant read).
     */
    async getByEmail(email: string): Promise<TenantUser | null> {
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

      return itemToUser(result.Items[0] as UserItem);
    },

    /**
     * List all users of a tenant, sorted by email.
     */
    async listByTenant(tenantId: string): Promise<readonly TenantUser[]> {
      validateTenantId(tenantId);

      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': tenantPK(tenantId),
            ':skPrefix': 'USER#',
          },
        }),
      );

      const items = (result.Items ?? []) as UserListingItem[];
      const users = items
        .filter((item) => item.entityType === 'USER_LISTING')
        .map(itemToUser);

      // Sort by email
      return users.sort((a, b) => a.email.localeCompare(b.email));
    },

    /**
     * Change a user's role within their tenant.
     */
    async setRole(
      tenantId: string,
      userId: string,
      role: TenantUserRole,
    ): Promise<TenantUser> {
      validateTenantId(tenantId);

      const existing = await getUser(tenantId, userId);
      if (!existing) {
        throw new Error('User not found');
      }

      const updatedItem: UserItem = {
        ...existing,
        role,
      };

      const listingItem: UserListingItem = {
        PK: tenantPK(tenantId),
        SK: userSK(userId),
        entityType: 'USER_LISTING',
        id: existing.id,
        tenantId: existing.tenantId,
        email: existing.email,
        name: existing.name,
        role,
        status: existing.status,
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

      return itemToUser(updatedItem);
    },

    /**
     * Change a user's lifecycle status.
     */
    async setStatus(
      tenantId: string,
      userId: string,
      status: TenantUserStatus,
    ): Promise<TenantUser> {
      validateTenantId(tenantId);

      const existing = await getUser(tenantId, userId);
      if (!existing) {
        throw new Error('User not found');
      }

      const updatedItem: UserItem = {
        ...existing,
        status,
      };

      const listingItem: UserListingItem = {
        PK: tenantPK(tenantId),
        SK: userSK(userId),
        entityType: 'USER_LISTING',
        id: existing.id,
        tenantId: existing.tenantId,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        status,
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

      return itemToUser(updatedItem);
    },

    /**
     * Bind a Cognito identity to a claimed user and activate them (ADR-0012).
     */
    async bindIdentity(
      tenantId: string,
      userId: string,
      cognitoId: string,
    ): Promise<TenantUser> {
      validateTenantId(tenantId);

      const existing = await getUser(tenantId, userId);
      if (!existing) {
        throw new Error('User not found');
      }

      const updatedItem: UserItem = {
        ...existing,
        cognitoId,
        status: 'active',
      };

      const listingItem: UserListingItem = {
        PK: tenantPK(tenantId),
        SK: userSK(userId),
        entityType: 'USER_LISTING',
        id: existing.id,
        tenantId: existing.tenantId,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        status: 'active',
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

      return itemToUser(updatedItem);
    },

    /**
     * Remove a single user from a tenant.
     * MUST refuse to remove the last active admin.
     */
    async remove(tenantId: string, userId: string): Promise<void> {
      validateTenantId(tenantId);

      const existing = await getUser(tenantId, userId);
      if (!existing) {
        throw new Error('User not found');
      }

      // Check last-admin guard if this is an active admin
      if (existing.role === 'admin' && existing.status === 'active') {
        const allUsers = await this.listByTenant(tenantId);
        const activeAdmins = allUsers.filter(
          (u) => u.role === 'admin' && u.status === 'active',
        );

        if (activeAdmins.length <= 1) {
          throw new Error('Cannot remove the last active admin');
        }
      }

      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: userPK(tenantId, userId),
                  SK: userSK(userId),
                },
              },
            },
            {
              Delete: {
                TableName: tableName,
                Key: {
                  PK: tenantPK(tenantId),
                  SK: userSK(userId),
                },
              },
            },
          ],
        }),
      );
    },

    /**
     * Remove all users of a tenant (cascade delete, no last-admin guard).
     */
    async removeByTenant(tenantId: string): Promise<void> {
      validateTenantId(tenantId);

      const users = await this.listByTenant(tenantId);

      // Delete each user's items (user item + listing item)
      for (const user of users) {
        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              PK: userPK(tenantId, user.id),
              SK: userSK(user.id),
            },
          }),
        );

        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              PK: tenantPK(tenantId),
              SK: userSK(user.id),
            },
          }),
        );
      }
    },
  };
}

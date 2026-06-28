/**
 * User repository tests
 *
 * Per ADR-0010/0012: UserRepository is tenant-scoped except for getByEmail
 * which is a global lookup via GSI1 EMAIL#{email}.
 *
 * Key patterns:
 * - User item: PK = TENANT#{tenantId}#USER#{userId}, SK = USER#{userId}
 * - Listing item: PK = TENANT#{tenantId}, SK = USER#{userId}
 * - GSI1: PK = EMAIL#{email}, SK = USER#{userId}
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { createUserRepository } from '../user-repository.js';
import type { UserRepository } from '@bench/types';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('UserRepository', () => {
  const tableName = 'test-table';
  let repo: UserRepository;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const userId = 'user-00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    ddbMock.reset();
    repo = createUserRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('create', () => {
    it('writes user item and listing item in transaction', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.create(tenantA, {
        email: 'alice@example.com',
        role: 'admin',
        name: 'Alice',
      });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems;
      expect(items).toHaveLength(2); // User item + listing item
    });

    it('normalizes email to lowercase', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        email: 'ALICE@EXAMPLE.COM',
        role: 'admin',
      });

      expect(result.email).toBe('alice@example.com');
    });

    it('sets status to pending by default', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        email: 'alice@example.com',
        role: 'admin',
      });

      expect(result.status).toBe('pending');
    });

    it('sets cognitoId to null', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        email: 'alice@example.com',
        role: 'admin',
      });

      expect(result.cognitoId).toBeNull();
    });

    it('returns created user with all fields', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        email: 'alice@example.com',
        role: 'admin',
        name: 'Alice Smith',
        invitedBy: 'bob@example.com',
      });

      expect(result.email).toBe('alice@example.com');
      expect(result.role).toBe('admin');
      expect(result.name).toBe('Alice Smith');
      expect(result.invitedBy).toBe('bob@example.com');
      expect(result.tenantId).toBe(tenantA);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('writes correct GSI1 keys for email lookup', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.create(tenantA, {
        email: 'alice@example.com',
        role: 'admin',
      });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      const items = calls[0].args[0].input.TransactItems ?? [];

      // Find the user item (has GSI1PK)
      const userItem = items.find((i) => i.Put?.Item?.GSI1PK);
      expect(userItem?.Put?.Item?.GSI1PK).toBe('EMAIL#alice@example.com');
    });
  });

  describe('getByEmail', () => {
    it('queries GSI1 and returns user for matching email', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}#USER#${userId}`,
          SK: `USER#${userId}`,
          GSI1PK: 'EMAIL#alice@example.com',
          GSI1SK: `USER#${userId}`,
          entityType: 'USER',
          id: userId,
          tenantId: tenantA,
          email: 'alice@example.com',
          name: 'Alice',
          role: 'admin',
          status: 'active',
          cognitoId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.getByEmail('alice@example.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('alice@example.com');
      expect(result?.tenantId).toBe(tenantA);
    });

    it('returns null for non-existent email', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.getByEmail('nobody@example.com');

      expect(result).toBeNull();
    });

    it('is case-insensitive', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.getByEmail('ALICE@EXAMPLE.COM');

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;
      expect(input.ExpressionAttributeValues?.[':pk']).toBe('EMAIL#alice@example.com');
    });

    it('uses GSI1 index', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.getByEmail('alice@example.com');

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;
      expect(input.IndexName).toBe('GSI1');
    });
  });

  describe('listByTenant', () => {
    it('returns only users for that tenant sorted by email', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}`,
          SK: `USER#user-2`,
          entityType: 'USER_LISTING',
          id: 'user-2',
          tenantId: tenantA,
          email: 'zebra@example.com',
          role: 'viewer',
          status: 'active',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
        {
          PK: `TENANT#${tenantA}`,
          SK: `USER#user-1`,
          entityType: 'USER_LISTING',
          id: 'user-1',
          tenantId: tenantA,
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.listByTenant(tenantA);

      expect(result).toHaveLength(2);
      // Sorted by email
      expect(result[0].email).toBe('alice@example.com');
      expect(result[1].email).toBe('zebra@example.com');
    });

    it('returns empty array for tenant with no users', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.listByTenant(tenantA);

      expect(result).toEqual([]);
    });

    it('queries with correct tenant-prefixed key', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.listByTenant(tenantA);

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}`);
      expect(input.ExpressionAttributeValues?.[':skPrefix']).toBe('USER#');
    });
  });

  describe('setRole', () => {
    it('updates role and returns updated user', async () => {
      const existingItem = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'viewer',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.setRole(tenantA, userId, 'admin');

      expect(result.role).toBe('admin');
    });

    it('throws for non-existent user', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.setRole(tenantA, userId, 'admin')).rejects.toThrow('User not found');
    });

    it('throws for wrong tenant (defense in depth)', async () => {
      const existingItem = {
        PK: `TENANT#${tenantB}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantB, // Different tenant!
        email: 'alice@example.com',
        role: 'viewer',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });

      await expect(repo.setRole(tenantA, userId, 'admin')).rejects.toThrow('User not found');
    });
  });

  describe('setStatus', () => {
    it('updates status and returns updated user', async () => {
      const existingItem = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'admin',
        status: 'pending',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.setStatus(tenantA, userId, 'active');

      expect(result.status).toBe('active');
    });

    it('throws for non-existent user', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.setStatus(tenantA, userId, 'active')).rejects.toThrow('User not found');
    });
  });

  describe('bindIdentity', () => {
    it('sets cognitoId AND status to active', async () => {
      const existingItem = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'admin',
        status: 'pending',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.bindIdentity(tenantA, userId, 'cognito-sub-12345');

      expect(result.cognitoId).toBe('cognito-sub-12345');
      expect(result.status).toBe('active');
    });

    it('throws for non-existent user', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.bindIdentity(tenantA, userId, 'cognito-sub-12345')).rejects.toThrow(
        'User not found',
      );
    });

    it('preserves other fields when binding identity', async () => {
      const existingItem = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        name: 'Alice Smith',
        role: 'admin',
        status: 'pending',
        cognitoId: null,
        invitedBy: 'bob@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.bindIdentity(tenantA, userId, 'cognito-sub-12345');

      expect(result.name).toBe('Alice Smith');
      expect(result.role).toBe('admin');
      expect(result.invitedBy).toBe('bob@example.com');
    });
  });

  describe('remove', () => {
    it('deletes user item and listing item', async () => {
      // Mock getUser to return the user
      const existingItem = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'viewer', // Not admin, so no last-admin check
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(QueryCommand).resolves({ Items: [] }); // listByTenant for admin check
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.remove(tenantA, userId);

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems ?? [];
      // Should have 2 Delete operations (user item + listing item)
      const deletes = items.filter((i) => i.Delete);
      expect(deletes).toHaveLength(2);
    });

    it('throws if removing last active admin', async () => {
      const adminUser = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'admin',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      // listByTenant returns only this admin (need entityType for filter)
      const listingItems = [
        {
          PK: `TENANT#${tenantA}`,
          SK: `USER#${userId}`,
          entityType: 'USER_LISTING',
          id: userId,
          tenantId: tenantA,
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(GetCommand).resolves({ Item: adminUser });
      ddbMock.on(QueryCommand).resolves({ Items: listingItems });

      await expect(repo.remove(tenantA, userId)).rejects.toThrow(
        'Cannot remove the last active admin',
      );
    });

    it('allows removing non-admin even if only one admin exists', async () => {
      const viewerUser = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'viewer@example.com',
        role: 'viewer',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: viewerUser });
      ddbMock.on(TransactWriteCommand).resolves({});

      // Should not throw
      await expect(repo.remove(tenantA, userId)).resolves.toBeUndefined();
    });

    it('allows removing admin if another active admin exists', async () => {
      const adminUser = {
        PK: `TENANT#${tenantA}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantA,
        email: 'alice@example.com',
        role: 'admin',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      // listByTenant returns two admins (need entityType for filter)
      const listingItems = [
        {
          PK: `TENANT#${tenantA}`,
          SK: `USER#${userId}`,
          entityType: 'USER_LISTING',
          id: userId,
          tenantId: tenantA,
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          PK: `TENANT#${tenantA}`,
          SK: 'USER#other-admin',
          entityType: 'USER_LISTING',
          id: 'other-admin',
          tenantId: tenantA,
          email: 'bob@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      ddbMock.on(GetCommand).resolves({ Item: adminUser });
      ddbMock.on(QueryCommand).resolves({ Items: listingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      // Should not throw
      await expect(repo.remove(tenantA, userId)).resolves.toBeUndefined();
    });
  });

  describe('removeByTenant', () => {
    it('deletes all users in tenant without last-admin guard', async () => {
      const listingItems = [
        {
          PK: `TENANT#${tenantA}`,
          SK: 'USER#user-1',
          entityType: 'USER_LISTING',
          id: 'user-1',
          tenantId: tenantA,
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        {
          PK: `TENANT#${tenantA}`,
          SK: 'USER#user-2',
          entityType: 'USER_LISTING',
          id: 'user-2',
          tenantId: tenantA,
          email: 'bob@example.com',
          role: 'viewer',
          status: 'active',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: listingItems });
      ddbMock.on(DeleteCommand).resolves({});

      // Should not throw even though we're removing the only admin
      await expect(repo.removeByTenant(tenantA)).resolves.toBeUndefined();
    });

    it('handles empty tenant gracefully', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await expect(repo.removeByTenant(tenantA)).resolves.toBeUndefined();
    });
  });

  describe('tenant isolation', () => {
    it('listByTenant cannot access another tenant partition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.listByTenant(tenantA);

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;

      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}`);
      expect(input.ExpressionAttributeValues?.[':pk']).not.toContain(tenantB);
    });
  });

  describe('defense in depth', () => {
    it('setRole rejects if fetched tenantId does not match', async () => {
      const existingItem = {
        PK: `TENANT#${tenantB}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantB, // Different from requested tenantA
        email: 'alice@example.com',
        role: 'viewer',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });

      await expect(repo.setRole(tenantA, userId, 'admin')).rejects.toThrow('User not found');
    });

    it('setStatus rejects if fetched tenantId does not match', async () => {
      const existingItem = {
        PK: `TENANT#${tenantB}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantB,
        email: 'alice@example.com',
        role: 'admin',
        status: 'pending',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });

      await expect(repo.setStatus(tenantA, userId, 'active')).rejects.toThrow('User not found');
    });

    it('remove rejects if fetched tenantId does not match', async () => {
      const existingItem = {
        PK: `TENANT#${tenantB}#USER#${userId}`,
        SK: `USER#${userId}`,
        entityType: 'USER',
        id: userId,
        tenantId: tenantB,
        email: 'alice@example.com',
        role: 'viewer',
        status: 'active',
        cognitoId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });

      await expect(repo.remove(tenantA, userId)).rejects.toThrow('User not found');
    });
  });
});

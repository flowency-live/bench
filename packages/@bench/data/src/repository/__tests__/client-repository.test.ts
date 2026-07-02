/**
 * Client repository tests
 *
 * Client items are tenant-scoped:
 * - Client item: PK = TENANT#{tenantId}#CLIENT#{clientId}, SK = CLIENT#{clientId}
 * - Listing item: PK = TENANT#{tenantId}, SK = CLIENT#{clientId}
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { createClientRepository } from '../client-repository.js';
import type { ClientRepository } from '../client-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ClientRepository', () => {
  const tableName = 'test-table';
  let repo: ClientRepository;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  beforeEach(() => {
    ddbMock.reset();
    repo = createClientRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('create', () => {
    it('writes client item and listing item in transaction', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.create(tenantA, {
        companyName: 'Acme Corp',
        visibilityMode: 'all_active',
        createdBy: 'admin@example.com',
      });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems;
      expect(items).toHaveLength(2); // Client item + listing item
    });

    it('returns created client with all fields', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        companyName: 'Acme Corp',
        visibilityMode: 'all_active',
        createdBy: 'admin@example.com',
      });

      expect(result.companyName).toBe('Acme Corp');
      expect(result.visibilityMode).toBe('all_active');
      expect(result.handpickedProfileIds).toEqual([]);
      expect(result.tenantId).toBe(tenantA);
      expect(result.createdBy).toBe('admin@example.com');
      expect(result.id).toMatch(/^client-/);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('trims company name', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        companyName: '  Acme Corp  ',
        visibilityMode: 'all_active',
        createdBy: 'admin@example.com',
      });

      expect(result.companyName).toBe('Acme Corp');
    });

    it('accepts handpicked profile IDs when mode is handpicked', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        companyName: 'Acme Corp',
        visibilityMode: 'handpicked',
        handpickedProfileIds: ['profile-1', 'profile-2'],
        createdBy: 'admin@example.com',
      });

      expect(result.visibilityMode).toBe('handpicked');
      expect(result.handpickedProfileIds).toEqual(['profile-1', 'profile-2']);
    });

    it('throws if tenantId is empty', async () => {
      await expect(
        repo.create('', {
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          createdBy: 'admin@example.com',
        }),
      ).rejects.toThrow('tenantId is required');
    });
  });

  describe('get', () => {
    it('returns client by ID', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CLIENT#client-001',
          entityType: 'CLIENT',
          id: 'client-001',
          tenantId: tenantA,
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          handpickedProfileIds: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
          createdBy: 'admin@example.com',
        },
      });

      const result = await repo.get(tenantA, 'client-001');

      expect(result).not.toBeNull();
      expect(result?.companyName).toBe('Acme Corp');
      expect(result?.tenantId).toBe(tenantA);
    });

    it('returns null if client not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repo.get(tenantA, 'nonexistent');

      expect(result).toBeNull();
    });

    it('returns null if tenantId does not match (defense in depth)', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-b#CLIENT#client-001',
          SK: 'CLIENT#client-001',
          entityType: 'CLIENT',
          id: 'client-001',
          tenantId: tenantB, // Different tenant
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          handpickedProfileIds: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
          createdBy: 'admin@example.com',
        },
      });

      const result = await repo.get(tenantA, 'client-001');

      expect(result).toBeNull();
    });
  });

  describe('listByTenant', () => {
    it('returns all clients for tenant', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'TENANT#tenant-a',
            SK: 'CLIENT#client-001',
            entityType: 'CLIENT_LISTING',
            id: 'client-001',
            tenantId: tenantA,
            companyName: 'Acme Corp',
            visibilityMode: 'all_active',
            createdAt: '2026-07-02T10:00:00.000Z',
          },
          {
            PK: 'TENANT#tenant-a',
            SK: 'CLIENT#client-002',
            entityType: 'CLIENT_LISTING',
            id: 'client-002',
            tenantId: tenantA,
            companyName: 'Beta Inc',
            visibilityMode: 'handpicked',
            createdAt: '2026-07-02T11:00:00.000Z',
          },
        ],
      });

      const result = await repo.listByTenant(tenantA);

      expect(result).toHaveLength(2);
      // Sorted by company name
      expect(result[0].companyName).toBe('Acme Corp');
      expect(result[1].companyName).toBe('Beta Inc');
    });

    it('returns empty array if no clients', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.listByTenant(tenantA);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates client and listing item', async () => {
      // First mock the get
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CLIENT#client-001',
          entityType: 'CLIENT',
          id: 'client-001',
          tenantId: tenantA,
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          handpickedProfileIds: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
          createdBy: 'admin@example.com',
        },
      });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.update(tenantA, 'client-001', {
        companyName: 'Acme Corporation',
      });

      expect(result.companyName).toBe('Acme Corporation');

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);
    });

    it('updates visibility mode and handpicked profiles', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CLIENT#client-001',
          entityType: 'CLIENT',
          id: 'client-001',
          tenantId: tenantA,
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          handpickedProfileIds: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
          createdBy: 'admin@example.com',
        },
      });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.update(tenantA, 'client-001', {
        visibilityMode: 'handpicked',
        handpickedProfileIds: ['profile-1', 'profile-2'],
      });

      expect(result.visibilityMode).toBe('handpicked');
      expect(result.handpickedProfileIds).toEqual(['profile-1', 'profile-2']);
    });

    it('throws if client not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(
        repo.update(tenantA, 'nonexistent', { companyName: 'New Name' }),
      ).rejects.toThrow('Client not found');
    });
  });

  describe('remove', () => {
    it('deletes client and listing item', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CLIENT#client-001',
          entityType: 'CLIENT',
          id: 'client-001',
          tenantId: tenantA,
          companyName: 'Acme Corp',
          visibilityMode: 'all_active',
          handpickedProfileIds: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
          createdBy: 'admin@example.com',
        },
      });
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.remove(tenantA, 'client-001');

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems;
      expect(items).toHaveLength(2); // Delete client + listing
      expect(items?.[0].Delete).toBeDefined();
      expect(items?.[1].Delete).toBeDefined();
    });

    it('throws if client not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.remove(tenantA, 'nonexistent')).rejects.toThrow('Client not found');
    });
  });
});

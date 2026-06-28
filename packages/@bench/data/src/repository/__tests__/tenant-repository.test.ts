/**
 * Tenant repository tests
 *
 * Per ADR-0010: TenantRepository is a godmode (cross-tenant) operation.
 * Unlike ProfileRepository, `list()` returns ALL tenants, not scoped to one.
 * Items are keyed `TENANT#{id}` with entityType='TENANT'.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { createTenantRepository } from '../tenant-repository.js';
import type { TenantRepository } from '@bench/types';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('TenantRepository', () => {
  const tableName = 'test-table';
  let repo: TenantRepository;

  beforeEach(() => {
    ddbMock.reset();
    repo = createTenantRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('list', () => {
    it('returns all tenants sorted by name', async () => {
      const items = [
        {
          PK: 'TENANT#zebra-corp',
          SK: 'TENANT#zebra-corp',
          entityType: 'TENANT',
          id: 'zebra-corp',
          name: 'Zebra Corp',
          instanceName: 'Zebra Hub',
          slug: 'zebra-corp',
          brandTokens: { bgPrimary: '#000' },
          customDomain: null,
          status: 'active',
          trialEndsAt: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          PK: 'TENANT#acme-inc',
          SK: 'TENANT#acme-inc',
          entityType: 'TENANT',
          id: 'acme-inc',
          name: 'Acme Inc',
          instanceName: 'Acme Portal',
          slug: 'acme-inc',
          brandTokens: { bgPrimary: '#fff' },
          customDomain: 'acme.com',
          status: 'active',
          trialEndsAt: null,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      ddbMock.on(ScanCommand).resolves({ Items: items });

      const result = await repo.list();

      expect(result).toHaveLength(2);
      // Should be sorted by name: Acme Inc before Zebra Corp
      expect(result[0].name).toBe('Acme Inc');
      expect(result[1].name).toBe('Zebra Corp');
    });

    it('returns empty array when no tenants exist', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });

      const result = await repo.list();

      expect(result).toEqual([]);
    });

    it('filters to only TENANT entityType items', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });

      await repo.list();

      const calls = ddbMock.commandCalls(ScanCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.FilterExpression).toContain('entityType = :entityType');
      expect(input.ExpressionAttributeValues?.[':entityType']).toBe('TENANT');
    });
  });

  describe('get', () => {
    it('returns tenant by id', async () => {
      const item = {
        PK: 'TENANT#acme-inc',
        SK: 'TENANT#acme-inc',
        entityType: 'TENANT',
        id: 'acme-inc',
        name: 'Acme Inc',
        instanceName: 'Acme Portal',
        slug: 'acme-inc',
        brandTokens: {
          bgPrimary: '#001930',
          bgPanel: '#002e52',
          accent: '#baeb5b',
          textPrimary: '#ffffff',
          textSecondary: '#9dadc8',
          fontDisplay: 'Poppins',
          fontBody: 'Poppins',
          logoAssetId: null,
        },
        customDomain: 'acme.com',
        status: 'active',
        trialEndsAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: item });

      const result = await repo.get('acme-inc');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('acme-inc');
      expect(result?.name).toBe('Acme Inc');
      expect(result?.instanceName).toBe('Acme Portal');
      expect(result?.brandTokens.bgPrimary).toBe('#001930');
    });

    it('returns null for non-existent tenant', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repo.get('non-existent');

      expect(result).toBeNull();
    });

    it('queries with correct key', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await repo.get('test-tenant');

      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.Key).toEqual({
        PK: 'TENANT#test-tenant',
        SK: 'TENANT#test-tenant',
      });
    });
  });

  describe('create', () => {
    it('generates id/slug from name using slugify', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'Acme Inc!' });

      expect(result.id).toBe('acme-inc');
      expect(result.slug).toBe('acme-inc');
    });

    it('handles special characters in name', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: '  Test & Company (UK)  ' });

      expect(result.id).toBe('test-company-uk');
      expect(result.slug).toBe('test-company-uk');
    });

    it('sets instanceName to name if not provided', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'Acme Inc' });

      expect(result.instanceName).toBe('Acme Inc');
    });

    it('uses provided instanceName', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({
        name: 'Change Connected',
        instanceName: 'Change Hub',
      });

      expect(result.instanceName).toBe('Change Hub');
    });

    it('merges partial brandTokens over DEFAULT_BRAND_TOKENS', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({
        name: 'Custom Brand',
        brandTokens: {
          bgPrimary: '#ff0000',
          accent: '#00ff00',
        },
      });

      // Custom values
      expect(result.brandTokens.bgPrimary).toBe('#ff0000');
      expect(result.brandTokens.accent).toBe('#00ff00');
      // Defaults from DEFAULT_BRAND_TOKENS
      expect(result.brandTokens.textPrimary).toBe('#ffffff');
      expect(result.brandTokens.fontDisplay).toBe('system-ui');
    });

    it('uses full DEFAULT_BRAND_TOKENS when no brandTokens provided', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'Default Brand' });

      expect(result.brandTokens.bgPrimary).toBe('#1a1a2e');
      expect(result.brandTokens.bgPanel).toBe('#16213e');
      expect(result.brandTokens.accent).toBe('#0f4c75');
    });

    it('sets status to active', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'New Tenant' });

      expect(result.status).toBe('active');
    });

    it('stamps createdAt and updatedAt', async () => {
      ddbMock.on(PutCommand).resolves({});

      const before = new Date().toISOString();
      const result = await repo.create({ name: 'New Tenant' });
      const after = new Date().toISOString();

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt >= before).toBe(true);
      expect(result.createdAt <= after).toBe(true);
      expect(result.createdAt).toBe(result.updatedAt);
    });

    it('sets customDomain when provided', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({
        name: 'Acme',
        customDomain: 'acme.example.com',
      });

      expect(result.customDomain).toBe('acme.example.com');
    });

    it('sets customDomain to null when not provided', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'Acme' });

      expect(result.customDomain).toBeNull();
    });

    it('sets trialEndsAt to null', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: 'Acme' });

      expect(result.trialEndsAt).toBeNull();
    });

    it('writes tenant item with correct keys', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create({ name: 'Test Tenant' });

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);

      const item = calls[0].args[0].input.Item;
      expect(item?.PK).toBe('TENANT#test-tenant');
      expect(item?.SK).toBe('TENANT#test-tenant');
      expect(item?.entityType).toBe('TENANT');
    });

    it('handles empty slug with timestamp fallback', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create({ name: '!!!' });

      // Should fallback to timestamp-based id
      expect(result.id).toMatch(/^tenant-\d+$/);
      expect(result.slug).toMatch(/^tenant-\d+$/);
    });
  });

  describe('setStatus', () => {
    it('updates status and updatedAt', async () => {
      const existingItem = {
        PK: 'TENANT#acme-inc',
        SK: 'TENANT#acme-inc',
        entityType: 'TENANT',
        id: 'acme-inc',
        name: 'Acme Inc',
        instanceName: 'Acme Portal',
        slug: 'acme-inc',
        brandTokens: { bgPrimary: '#000' },
        customDomain: null,
        status: 'active',
        trialEndsAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(PutCommand).resolves({});

      const before = new Date().toISOString();
      const result = await repo.setStatus('acme-inc', 'suspended');
      const after = new Date().toISOString();

      expect(result.status).toBe('suspended');
      expect(result.updatedAt >= before).toBe(true);
      expect(result.updatedAt <= after).toBe(true);
    });

    it('throws for non-existent tenant', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.setStatus('non-existent', 'suspended')).rejects.toThrow(
        'Tenant not found'
      );
    });

    it('preserves other fields when updating status', async () => {
      const existingItem = {
        PK: 'TENANT#acme-inc',
        SK: 'TENANT#acme-inc',
        entityType: 'TENANT',
        id: 'acme-inc',
        name: 'Acme Inc',
        instanceName: 'Acme Portal',
        slug: 'acme-inc',
        brandTokens: { bgPrimary: '#001930' },
        customDomain: 'acme.com',
        status: 'active',
        trialEndsAt: '2024-12-31T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingItem });
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.setStatus('acme-inc', 'suspended');

      expect(result.name).toBe('Acme Inc');
      expect(result.customDomain).toBe('acme.com');
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('delete', () => {
    it('removes the tenant item', async () => {
      // Mock: tenant item exists (returned by Query on PK = TENANT#{id})
      const tenantItem = {
        PK: 'TENANT#acme-inc',
        SK: 'TENANT#acme-inc',
        entityType: 'TENANT',
      };
      ddbMock.on(QueryCommand).resolves({ Items: [tenantItem] });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete('acme-inc');

      // Verify tenant item was included in batch delete
      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      expect(batchCalls.length).toBeGreaterThanOrEqual(1);

      // Verify the tenant item key was deleted
      const deleteRequests = batchCalls[0].args[0].input.RequestItems?.['test-table'] ?? [];
      const tenantDelete = deleteRequests.find(
        (req) =>
          req.DeleteRequest?.Key?.PK === 'TENANT#acme-inc' &&
          req.DeleteRequest?.Key?.SK === 'TENANT#acme-inc'
      );
      expect(tenantDelete).toBeDefined();
    });

    it('is idempotent (no-op for non-existent)', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      // Should not throw
      await expect(repo.delete('non-existent')).resolves.toBeUndefined();
    });

    it('cascades delete to USER_LISTING items', async () => {
      const tenantId = 'test-tenant';
      const listingItems = [
        {
          PK: `TENANT#${tenantId}`,
          SK: `TENANT#${tenantId}`,
          entityType: 'TENANT',
        },
        {
          PK: `TENANT#${tenantId}`,
          SK: 'USER#user-1',
          entityType: 'USER_LISTING',
        },
        {
          PK: `TENANT#${tenantId}`,
          SK: 'USER#user-2',
          entityType: 'USER_LISTING',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: listingItems });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      expect(batchCalls.length).toBeGreaterThanOrEqual(1);

      // Collect all delete requests
      const allDeleteRequests = batchCalls.flatMap(
        (call) => call.args[0].input.RequestItems?.['test-table'] ?? []
      );

      // Should include all 3 items (tenant + 2 user listings)
      expect(allDeleteRequests.length).toBeGreaterThanOrEqual(3);
    });

    it('cascades delete to PROFILE_LISTING items', async () => {
      const tenantId = 'test-tenant';
      const listingItems = [
        {
          PK: `TENANT#${tenantId}`,
          SK: `TENANT#${tenantId}`,
          entityType: 'TENANT',
        },
        {
          PK: `TENANT#${tenantId}`,
          SK: 'PROFILE#profile-1',
          entityType: 'PROFILE_LISTING',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: listingItems });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      const allDeleteRequests = batchCalls.flatMap(
        (call) => call.args[0].input.RequestItems?.['test-table'] ?? []
      );

      // Should include tenant + profile listing
      expect(allDeleteRequests.length).toBeGreaterThanOrEqual(2);
    });

    it('cascades delete to USER items (full user records)', async () => {
      const tenantId = 'test-tenant';
      const userItems = [
        {
          PK: `TENANT#${tenantId}#USER#user-1`,
          SK: 'USER#user-1',
          entityType: 'USER',
          GSI1PK: 'EMAIL#alice@example.com',
        },
        {
          PK: `TENANT#${tenantId}#USER#user-2`,
          SK: 'USER#user-2',
          entityType: 'USER',
          GSI1PK: 'EMAIL#bob@example.com',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: [] }); // No listing items
      ddbMock.on(ScanCommand).resolves({ Items: userItems });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      const allDeleteRequests = batchCalls.flatMap(
        (call) => call.args[0].input.RequestItems?.['test-table'] ?? []
      );

      // Should delete both user items
      const userDeletes = allDeleteRequests.filter(
        (req) => req.DeleteRequest?.Key?.SK?.startsWith('USER#')
      );
      expect(userDeletes).toHaveLength(2);
    });

    it('cascades delete to PROFILE items and their children', async () => {
      const tenantId = 'test-tenant';
      const profileItems = [
        {
          PK: `TENANT#${tenantId}#PROFILE#profile-1`,
          SK: 'PROFILE#profile-1',
          entityType: 'PROFILE',
        },
        {
          PK: `TENANT#${tenantId}#PROFILE#profile-1`,
          SK: 'SKILL#0001',
          entityType: 'SKILL',
        },
        {
          PK: `TENANT#${tenantId}#PROFILE#profile-1`,
          SK: 'STORY#0001',
          entityType: 'STORY',
        },
        {
          PK: `TENANT#${tenantId}#PROFILE#profile-1`,
          SK: 'LINK#invite#abc',
          entityType: 'MAGIC_LINK',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(ScanCommand).resolves({ Items: profileItems });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      const allDeleteRequests = batchCalls.flatMap(
        (call) => call.args[0].input.RequestItems?.['test-table'] ?? []
      );

      // Should delete profile + skill + story + link = 4 items
      expect(allDeleteRequests).toHaveLength(4);
    });

    it('queries the correct partitions for cascade', async () => {
      const tenantId = 'test-tenant';

      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      // Verify Query was called for TENANT#{id} partition (listing items)
      const queryCalls = ddbMock.commandCalls(QueryCommand);
      expect(queryCalls).toHaveLength(1);
      expect(queryCalls[0].args[0].input.KeyConditionExpression).toContain('PK = :pk');
      expect(queryCalls[0].args[0].input.ExpressionAttributeValues?.[':pk']).toBe(
        `TENANT#${tenantId}`
      );

      // Verify Scan was called for TENANT#{id}# prefix (user/profile items)
      const scanCalls = ddbMock.commandCalls(ScanCommand);
      expect(scanCalls).toHaveLength(1);
      expect(scanCalls[0].args[0].input.FilterExpression).toContain('begins_with(PK, :pkPrefix)');
      expect(scanCalls[0].args[0].input.ExpressionAttributeValues?.[':pkPrefix']).toBe(
        `TENANT#${tenantId}#`
      );
    });

    it('handles large number of items with batching', async () => {
      const tenantId = 'test-tenant';
      // Create 30 items (more than BatchWrite limit of 25)
      const manyItems = Array.from({ length: 30 }, (_, i) => ({
        PK: `TENANT#${tenantId}#PROFILE#profile-${i}`,
        SK: `PROFILE#profile-${i}`,
        entityType: 'PROFILE',
      }));

      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(ScanCommand).resolves({ Items: manyItems });
      ddbMock.on(BatchWriteCommand).resolves({});

      await repo.delete(tenantId);

      const batchCalls = ddbMock.commandCalls(BatchWriteCommand);
      // Should be split into multiple batches (30 items / 25 per batch = 2 batches)
      expect(batchCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty tenant with no items gracefully', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(ScanCommand).resolves({ Items: [] });
      ddbMock.on(BatchWriteCommand).resolves({});

      // Should not throw
      await expect(repo.delete('empty-tenant')).resolves.toBeUndefined();
    });
  });
});

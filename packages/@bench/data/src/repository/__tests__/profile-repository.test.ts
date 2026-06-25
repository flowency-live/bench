/**
 * Profile repository isolation tests
 *
 * Per ADR-0008: Tests assert scoping on every method.
 * - Tenant A cannot read/write tenant B data
 * - Missing/blank tenant yields nothing (never full-table read)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createProfileRepository, type ProfileRepository } from '../profile-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ProfileRepository', () => {
  const tableName = 'test-table';
  let repo: ProfileRepository;

  const tenantA = 'tenant-a-00000000-0000-0000-0000-000000000001';
  const tenantB = 'tenant-b-00000000-0000-0000-0000-000000000002';
  const profileId = 'profile-00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    ddbMock.reset();
    repo = createProfileRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('findById', () => {
    it('returns profile for correct tenant', async () => {
      const profileItem = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `PROFILE#${profileId}`,
        id: profileId,
        tenantId: tenantA,
        consultantName: 'Alice',
        consultantEmail: 'alice@example.com',
        role: 'Consultant',
        status: 'draft',
        headline: null,
        bio: null,
        headshotAssetId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        submittedAt: null,
        publishedAt: null,
        archivedAt: null,
      };

      ddbMock.on(GetCommand).resolves({ Item: profileItem });

      const result = await repo.findById(tenantA, profileId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(profileId);
      expect(result?.tenantId).toBe(tenantA);
      expect(result?.consultantName).toBe('Alice');
    });

    it('returns null when profile belongs to different tenant', async () => {
      // Profile exists but belongs to tenant B
      const profileItem = {
        PK: `TENANT#${tenantB}#PROFILE#${profileId}`,
        SK: `PROFILE#${profileId}`,
        id: profileId,
        tenantId: tenantB, // Different tenant!
        consultantName: 'Bob',
        consultantEmail: 'bob@example.com',
        role: 'Consultant',
        status: 'draft',
        headline: null,
        bio: null,
        headshotAssetId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        submittedAt: null,
        publishedAt: null,
        archivedAt: null,
      };

      ddbMock.on(GetCommand).resolves({ Item: profileItem });

      // Tenant A tries to access tenant B's profile
      const result = await repo.findById(tenantA, profileId);

      // Defense in depth: even if DynamoDB returned it, we reject it
      expect(result).toBeNull();
    });

    it('returns null when profile does not exist', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repo.findById(tenantA, 'non-existent-id');

      expect(result).toBeNull();
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.findById('', profileId)).rejects.toThrow('tenantId is required');
    });

    it('throws error when tenantId is undefined', async () => {
      await expect(repo.findById(undefined as unknown as string, profileId)).rejects.toThrow('tenantId is required');
    });
  });

  describe('findAll', () => {
    it('queries with correct tenant-prefixed key', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.findAll(tenantA);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.KeyConditionExpression).toContain('PK = :pk');
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}`);
    });

    it('returns only profiles from the tenant partition', async () => {
      const items = [
        { id: 'profile-1', tenantId: tenantA, consultantName: 'Alice', role: 'Dev', status: 'draft', updatedAt: '2024-01-01' },
        { id: 'profile-2', tenantId: tenantA, consultantName: 'Carol', role: 'PM', status: 'published', updatedAt: '2024-01-02' },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.findAll(tenantA);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.tenantId === tenantA)).toBe(true);
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.findAll('')).rejects.toThrow('tenantId is required');
    });
  });

  describe('findByStatus', () => {
    it('uses GSI2 with tenant-scoped partition key', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.findByStatus(tenantA, 'published');

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.IndexName).toBe('GSI2');
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}#STATUS#published`);
    });

    it('cannot query another tenant status', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      // Even if tenant B has published profiles, tenant A's query won't find them
      // because the GSI2PK is tenant-prefixed
      await repo.findByStatus(tenantA, 'published');

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;

      // The key explicitly includes tenant A, so tenant B's data is not accessible
      expect(input.ExpressionAttributeValues?.[':pk']).not.toContain(tenantB);
    });
  });

  describe('create', () => {
    it('creates profile with correct tenant-prefixed keys', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create(tenantA, {
        id: profileId,
        consultantName: 'New User',
        consultantEmail: 'new@example.com',
      });

      const calls = ddbMock.commandCalls(PutCommand);
      // Creates two items: one for direct access, one for listing
      expect(calls).toHaveLength(2);

      const item1 = calls[0].args[0].input.Item;
      expect(item1?.PK).toBe(`TENANT#${tenantA}#PROFILE#${profileId}`);
      expect(item1?.tenantId).toBe(tenantA);

      const item2 = calls[1].args[0].input.Item;
      expect(item2?.PK).toBe(`TENANT#${tenantA}`);
      expect(item2?.tenantId).toBe(tenantA);
    });

    it('sets GSI2 key for status queries', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create(tenantA, {
        id: profileId,
        consultantName: 'New User',
        consultantEmail: 'new@example.com',
      });

      const calls = ddbMock.commandCalls(PutCommand);
      const item = calls[0].args[0].input.Item;

      expect(item?.GSI2PK).toBe(`TENANT#${tenantA}#STATUS#draft`);
    });
  });

  describe('updateStatus', () => {
    it('uses condition expression to verify tenant ownership', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await repo.updateStatus(tenantA, profileId, 'submitted');

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls.length).toBeGreaterThanOrEqual(1);

      const input = calls[0].args[0].input;
      expect(input.ConditionExpression).toContain('tenantId = :tenantId');
      expect(input.ExpressionAttributeValues?.[':tenantId']).toBe(tenantA);
    });
  });

  describe('updatePositioning', () => {
    it('uses condition expression to verify tenant ownership', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await repo.updatePositioning(tenantA, profileId, {
        headline: 'Expert Developer',
        bio: 'Building great software',
      });

      const calls = ddbMock.commandCalls(UpdateCommand);
      const input = calls[0].args[0].input;

      expect(input.ConditionExpression).toContain('tenantId = :tenantId');
    });
  });

  describe('updateHeadshot', () => {
    it('uses condition expression to verify tenant ownership', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await repo.updateHeadshot(tenantA, profileId, 'asset-123');

      const calls = ddbMock.commandCalls(UpdateCommand);
      const input = calls[0].args[0].input;

      expect(input.ConditionExpression).toContain('tenantId = :tenantId');
    });
  });
});

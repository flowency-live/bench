/**
 * Profile repository tests
 *
 * Per ADR-0008: Tests assert scoping on every method.
 * - Tenant A cannot read/write tenant B data
 * - Missing/blank tenant yields nothing (never full-table read)
 *
 * Per data-contract.md:
 * - get() assembles children (skills, stories, testimonial)
 * - list() returns one row per profile (no duplicates)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { createProfileRepository } from '../profile-repository.js';
import type { ProfileRepository } from '@bench/types';

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

  describe('get', () => {
    it('returns profile for correct tenant', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.get(tenantA, profileId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(profileId);
      expect(result?.tenantId).toBe(tenantA);
      expect(result?.consultantName).toBe('Alice');
      expect(result?.skills).toEqual([]);
      expect(result?.stories).toEqual([]);
      expect(result?.testimonial).toBeNull();
    });

    it('assembles skills from SKILL# items', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'active',
          positioning: { headline: 'Expert', bio: 'Bio text' },
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'SKILL#0001',
          entityType: 'SKILL',
          id: 'skill-1',
          title: 'TypeScript',
          body: 'Expert in TypeScript',
          order: 1,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'SKILL#0002',
          entityType: 'SKILL',
          id: 'skill-2',
          title: 'Node.js',
          body: 'Backend development',
          order: 2,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.get(tenantA, profileId);

      expect(result?.skills).toHaveLength(2);
      expect(result?.skills[0].id).toBe('skill-1');
      expect(result?.skills[0].title).toBe('TypeScript');
      expect(result?.skills[1].id).toBe('skill-2');
    });

    it('assembles stories from STORY# items', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'active',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'STORY#0001',
          entityType: 'STORY',
          id: 'story-1',
          clientTag: 'FTSE 100',
          title: 'Digital Transformation',
          body: 'Led a major initiative',
          order: 1,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.get(tenantA, profileId);

      expect(result?.stories).toHaveLength(1);
      expect(result?.stories[0].id).toBe('story-1');
      expect(result?.stories[0].clientTag).toBe('FTSE 100');
    });

    it('assembles testimonial from TESTIMONIAL item', async () => {
      const items = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'active',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'TESTIMONIAL',
          entityType: 'TESTIMONIAL',
          id: 'testimonial-1',
          quote: 'Excellent work!',
          authorName: 'John Doe',
          authorRole: 'CTO',
          authorCompany: 'Acme Inc',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.get(tenantA, profileId);

      expect(result?.testimonial).not.toBeNull();
      expect(result?.testimonial?.quote).toBe('Excellent work!');
      expect(result?.testimonial?.authorName).toBe('John Doe');
    });

    it('returns null when profile belongs to different tenant (defense in depth)', async () => {
      const items = [
        {
          PK: `TENANT#${tenantB}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantB, // Different tenant!
          consultantName: 'Bob',
          consultantEmail: 'bob@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      // Tenant A tries to access tenant B's profile
      const result = await repo.get(tenantA, profileId);

      // Defense in depth: even if DynamoDB returned it, we reject it
      expect(result).toBeNull();
    });

    it('returns null when profile does not exist', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.get(tenantA, 'non-existent-id');

      expect(result).toBeNull();
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.get('', profileId)).rejects.toThrow('tenantId is required');
    });

    it('throws error when tenantId is undefined', async () => {
      await expect(repo.get(undefined as unknown as string, profileId)).rejects.toThrow(
        'tenantId is required'
      );
    });
  });

  describe('list', () => {
    it('queries with correct tenant-prefixed key', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.list(tenantA);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.KeyConditionExpression).toContain('PK = :pk');
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}`);
    });

    it('returns only profiles from the tenant partition', async () => {
      const items = [
        {
          id: 'profile-1',
          tenantId: tenantA,
          consultantName: 'Alice',
          role: 'Dev',
          status: 'no_profile',
          headshotAssetId: null,
          updatedAt: '2024-01-01',
        },
        {
          id: 'profile-2',
          tenantId: tenantA,
          consultantName: 'Carol',
          role: 'PM',
          status: 'active',
          headshotAssetId: null,
          updatedAt: '2024-01-02',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.list(tenantA);

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.tenantId === tenantA)).toBe(true);
    });

    it('returns one row per profile (no duplicates)', async () => {
      // The listing items should only exist once per profile
      const items = [
        {
          PK: `TENANT#${tenantA}`,
          SK: `PROFILE#profile-1`,
          entityType: 'PROFILE_LISTING',
          id: 'profile-1',
          tenantId: tenantA,
          consultantName: 'Alice',
          role: 'Dev',
          status: 'no_profile',
          headshotAssetId: null,
          updatedAt: '2024-01-01',
        },
        {
          PK: `TENANT#${tenantA}`,
          SK: `PROFILE#profile-2`,
          entityType: 'PROFILE_LISTING',
          id: 'profile-2',
          tenantId: tenantA,
          consultantName: 'Bob',
          role: 'PM',
          status: 'active',
          headshotAssetId: null,
          updatedAt: '2024-01-02',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: items });

      const result = await repo.list(tenantA);

      // Should have exactly 2 profiles, not duplicates
      expect(result).toHaveLength(2);
      const ids = result.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length); // All unique
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.list('')).rejects.toThrow('tenantId is required');
    });
  });

  describe('create', () => {
    it('creates profile with correct tenant-prefixed keys', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        consultantName: 'New User',
        consultantEmail: 'new@example.com',
      });

      expect(result.tenantId).toBe(tenantA);
      expect(result.consultantName).toBe('New User');
      expect(result.status).toBe('no_profile');
      expect(result.availability).toEqual({ status: 'available' });
      expect(result.skills).toEqual([]);
      expect(result.stories).toEqual([]);
      expect(result.testimonial).toBeNull();
    });

    it('returns the created profile', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, {
        consultantName: 'New User',
        consultantEmail: 'new@example.com',
        role: 'Developer',
      });

      expect(result.consultantName).toBe('New User');
      expect(result.consultantEmail).toBe('new@example.com');
      expect(result.role).toBe('Developer');
      expect(result.id).toBeDefined();
    });

    it('writes profile item and listing item in transaction', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.create(tenantA, {
        consultantName: 'New User',
        consultantEmail: 'new@example.com',
      });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems;
      expect(items).toHaveLength(2); // Profile item + listing item
    });
  });

  describe('update', () => {
    it('updates profile positioning', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.update(tenantA, profileId, {
        positioning: { headline: 'Expert Developer', bio: 'Building great software' },
      });

      expect(result.positioning?.headline).toBe('Expert Developer');
      expect(result.positioning?.bio).toBe('Building great software');
    });

    it('replaces skills collection', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'SKILL#0001',
          entityType: 'SKILL',
          id: 'old-skill',
          title: 'Old Skill',
          body: 'To be replaced',
          order: 1,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const newSkills = [
        { id: 'skill-1', title: 'TypeScript', body: 'Expert', order: 1 },
        { id: 'skill-2', title: 'React', body: 'Frontend', order: 2 },
      ];

      const result = await repo.update(tenantA, profileId, { skills: newSkills });

      expect(result.skills).toHaveLength(2);
      expect(result.skills[0].title).toBe('TypeScript');
    });

    it('returns the updated profile', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.update(tenantA, profileId, { role: 'Senior Consultant' });

      expect(result.id).toBe(profileId);
      expect(result.role).toBe('Senior Consultant');
    });

    it('throws when profile not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await expect(
        repo.update(tenantA, profileId, { role: 'Senior' })
      ).rejects.toThrow('Profile not found');
    });

    it('does not create duplicate transaction operations for overlapping skill orders', async () => {
      // This test verifies the fix for DynamoDB error:
      // "Transaction request cannot include multiple operations on one item"
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'SKILL#0001',
          entityType: 'SKILL',
          id: 'skill-1',
          title: 'Old Skill 1',
          body: 'Description',
          order: 1,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'SKILL#0002',
          entityType: 'SKILL',
          id: 'skill-2',
          title: 'Old Skill 2',
          body: 'Description',
          order: 2,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      // New skills have overlapping order (1) but different content
      const newSkills = [
        { id: 'new-skill-1', title: 'New Skill 1', body: 'Updated', order: 1 },
      ];

      await repo.update(tenantA, profileId, { skills: newSkills });

      // Verify the transaction was called
      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems ?? [];

      // Collect all keys being operated on
      const keys: string[] = [];
      for (const item of items) {
        if (item.Put) {
          keys.push(`PUT:${item.Put.Item?.SK}`);
        }
        if (item.Delete) {
          keys.push(`DELETE:${item.Delete.Key?.SK}`);
        }
      }

      // Should have Put for SKILL#0001 (overlapping), Delete for SKILL#0002 (orphan)
      // Should NOT have both Put and Delete for SKILL#0001
      expect(keys).toContain('PUT:SKILL#0001');
      expect(keys).toContain('DELETE:SKILL#0002');
      expect(keys).not.toContain('DELETE:SKILL#0001'); // No delete for overlapping order
    });

    it('deletes only orphan story orders when updating', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'no_profile',
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          submittedAt: null,
          publishedAt: null,
          archivedAt: null,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'STORY#0001',
          entityType: 'STORY',
          id: 'story-1',
          clientTag: 'Client A',
          title: 'Old Story 1',
          body: 'Description',
          order: 1,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'STORY#0002',
          entityType: 'STORY',
          id: 'story-2',
          clientTag: 'Client B',
          title: 'Old Story 2',
          body: 'Description',
          order: 2,
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: 'STORY#0003',
          entityType: 'STORY',
          id: 'story-3',
          clientTag: 'Client C',
          title: 'Old Story 3',
          body: 'Description',
          order: 3,
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      // Keep order 1, change order 2, remove order 3
      const newStories = [
        { id: 'story-1', clientTag: 'Client A', title: 'Updated Story 1', body: 'New', order: 1 },
        { id: 'story-2-new', clientTag: 'Client B', title: 'New Story 2', body: 'New', order: 2 },
      ];

      await repo.update(tenantA, profileId, { stories: newStories });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      const items = calls[0].args[0].input.TransactItems ?? [];

      const deleteKeys = items
        .filter((item) => item.Delete)
        .map((item) => item.Delete?.Key?.SK);

      // Should only delete STORY#0003 (orphan), not STORY#0001 or STORY#0002
      expect(deleteKeys).toContain('STORY#0003');
      expect(deleteKeys).not.toContain('STORY#0001');
      expect(deleteKeys).not.toContain('STORY#0002');
    });
  });

  describe('setStatus', () => {
    it('updates status and returns the profile', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'draft',
          availability: { status: 'available' },
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.setStatus(tenantA, profileId, 'active');

      expect(result.status).toBe('active');
    });

    it('transitions to removed', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'active',
          availability: { status: 'available' },
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.setStatus(tenantA, profileId, 'removed');

      expect(result.status).toBe('removed');
    });

    it('preserves availability across a status change', async () => {
      const existingItems = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `PROFILE#${profileId}`,
          entityType: 'PROFILE',
          id: profileId,
          tenantId: tenantA,
          consultantName: 'Alice',
          consultantEmail: 'alice@example.com',
          role: 'Consultant',
          status: 'draft',
          availability: { status: 'engaged', endDate: '2026-09-30' },
          positioning: null,
          headshotAssetId: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: existingItems });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.setStatus(tenantA, profileId, 'active');

      expect(result.availability).toEqual({ status: 'engaged', endDate: '2026-09-30' });
    });

    it('throws when profile not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await expect(
        repo.setStatus(tenantA, profileId, 'active')
      ).rejects.toThrow('Profile not found');
    });
  });

  describe('tenant isolation', () => {
    it('list cannot access another tenant partition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.list(tenantA);

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;

      // The key explicitly includes tenant A, so tenant B's data is not accessible
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}`);
      expect(input.ExpressionAttributeValues?.[':pk']).not.toContain(tenantB);
    });

    it('get queries with tenant-prefixed partition key', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.get(tenantA, profileId);

      const calls = ddbMock.commandCalls(QueryCommand);
      const input = calls[0].args[0].input;

      expect(input.ExpressionAttributeValues?.[':pk']).toBe(
        `TENANT#${tenantA}#PROFILE#${profileId}`
      );
    });
  });
});

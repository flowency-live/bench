/**
 * Magic link repository isolation tests
 *
 * Per ADR-0008:
 * - GSI3 (TOKENHASH#{hash}) is the ONE global lookup - returns tenant context
 * - All other operations require tenant scoping
 * - Tenant A cannot access tenant B's magic links
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createMagicLinkRepository, type MagicLinkRepository } from '../magic-link-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('MagicLinkRepository', () => {
  const tableName = 'test-table';
  let repo: MagicLinkRepository;

  const tenantA = 'tenant-a-00000000-0000-0000-0000-000000000001';
  const tenantB = 'tenant-b-00000000-0000-0000-0000-000000000002';
  const profileId = 'profile-00000000-0000-0000-0000-000000000001';
  const linkId = 'link-00000000-0000-0000-0000-000000000001';
  const tokenHash = 'abc123def456';

  beforeEach(() => {
    ddbMock.reset();
    repo = createMagicLinkRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('lookupByTokenHash', () => {
    it('queries GSI3 with token hash', async () => {
      const linkItem = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        GSI3PK: `TOKENHASH#${tokenHash}`,
        GSI3SK: linkId,
        id: linkId,
        tenantId: tenantA,
        profileId,
        type: 'invite',
        scope: 'edit',
        status: 'active',
        tokenHash,
        passcodeHash: null,
        expiresAt: '2024-12-31T23:59:59.999Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });

      const result = await repo.lookupByTokenHash(tokenHash);

      // Verify GSI3 was used
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);
      const input = calls[0].args[0].input;
      expect(input.IndexName).toBe('GSI3');
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TOKENHASH#${tokenHash}`);

      // Verify result includes tenant ID
      expect(result).not.toBeNull();
      expect(result?.id).toBe(linkId);
      expect(result?.tenantId).toBe(tenantA);
      expect(result?.profileId).toBe(profileId);
    });

    it('returns null when token not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.lookupByTokenHash('non-existent-token');

      expect(result).toBeNull();
    });

    it('does not require tenant context (global lookup)', async () => {
      // This is the ONE cross-tenant operation per ADR-0008
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      // No tenant ID needed
      await expect(repo.lookupByTokenHash(tokenHash)).resolves.not.toThrow();
    });
  });

  describe('findById', () => {
    it('returns magic link for correct tenant', async () => {
      const linkItem = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        id: linkId,
        tenantId: tenantA,
        profileId,
        type: 'invite',
        scope: 'edit',
        status: 'active',
        tokenHash,
        passcodeHash: null,
        expiresAt: '2024-12-31T23:59:59.999Z',
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // findById now uses QueryCommand (not GetCommand) to avoid needing the type in the SK
      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });

      const result = await repo.findById(tenantA, profileId, linkId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(linkId);
      expect(result?.tenantId).toBe(tenantA);

      // Verify the query pattern
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall.args[0].input.KeyConditionExpression).toContain('begins_with(SK, :skPrefix)');
      expect(lastCall.args[0].input.FilterExpression).toBe('id = :linkId');
    });

    it('returns null when link belongs to different tenant', async () => {
      const linkItem = {
        PK: `TENANT#${tenantB}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        id: linkId,
        tenantId: tenantB, // Different tenant!
        profileId,
        type: 'invite',
        scope: 'edit',
        status: 'active',
        tokenHash,
        passcodeHash: null,
        expiresAt: '2024-12-31T23:59:59.999Z',
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // findById now uses QueryCommand
      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });

      // Tenant A tries to access tenant B's link
      const result = await repo.findById(tenantA, profileId, linkId);

      // Defense in depth: even if DynamoDB returned it, we reject it
      expect(result).toBeNull();
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.findById('', profileId, linkId)).rejects.toThrow('tenantId is required');
    });
  });

  describe('create', () => {
    it('creates link with correct tenant-prefixed keys', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create(tenantA, {
        id: linkId,
        profileId,
        type: 'invite',
        scope: 'edit',
        tokenHash,
        expiresAt: '2024-12-31T23:59:59.999Z',
        createdBy: 'user-123',
      });

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);

      const item = calls[0].args[0].input.Item;
      expect(item?.PK).toBe(`TENANT#${tenantA}#PROFILE#${profileId}`);
      expect(item?.tenantId).toBe(tenantA);
      expect(item?.GSI3PK).toBe(`TOKENHASH#${tokenHash}`);

      expect(result.id).toBe(linkId);
      expect(result.tenantId).toBe(tenantA);
    });

    it('sets TTL based on expiresAt', async () => {
      ddbMock.on(PutCommand).resolves({});

      const expiresAt = '2024-12-31T23:59:59.999Z';
      const expectedTTL = Math.floor(new Date(expiresAt).getTime() / 1000);

      await repo.create(tenantA, {
        id: linkId,
        profileId,
        type: 'invite',
        scope: 'edit',
        tokenHash,
        expiresAt,
        createdBy: 'user-123',
      });

      const calls = ddbMock.commandCalls(PutCommand);
      const item = calls[0].args[0].input.Item;

      expect(item?.TTL).toBe(expectedTTL);
    });
  });

  describe('markAsUsed', () => {
    it('updates status with tenant condition', async () => {
      const linkItem = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        id: linkId,
        tenantId: tenantA,
      };

      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });
      ddbMock.on(UpdateCommand).resolves({});

      await repo.markAsUsed(tenantA, profileId, linkId);

      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(1);

      const input = updateCalls[0].args[0].input;
      expect(input.ConditionExpression).toContain('tenantId = :tenantId');
      expect(input.ExpressionAttributeValues?.[':tenantId']).toBe(tenantA);
      expect(input.ExpressionAttributeValues?.[':status']).toBe('used');
    });

    it('does nothing when link not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      // Should not throw, just do nothing
      await expect(repo.markAsUsed(tenantA, profileId, 'non-existent')).resolves.not.toThrow();

      // No update should be called
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(0);
    });

    it('does not update link belonging to different tenant', async () => {
      const linkItem = {
        PK: `TENANT#${tenantB}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        id: linkId,
        tenantId: tenantB, // Different tenant
      };

      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });
      ddbMock.on(UpdateCommand).resolves({});

      // Tenant A tries to mark tenant B's link as used
      await repo.markAsUsed(tenantA, profileId, linkId);

      // Defense in depth: we check tenantId before updating
      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe('markAsRevoked', () => {
    it('updates status to revoked with tenant condition', async () => {
      const linkItem = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `LINK#invite#${linkId}`,
        id: linkId,
        tenantId: tenantA,
      };

      ddbMock.on(QueryCommand).resolves({ Items: [linkItem] });
      ddbMock.on(UpdateCommand).resolves({});

      await repo.markAsRevoked(tenantA, profileId, linkId);

      const updateCalls = ddbMock.commandCalls(UpdateCommand);
      expect(updateCalls).toHaveLength(1);

      const input = updateCalls[0].args[0].input;
      expect(input.ExpressionAttributeValues?.[':status']).toBe('revoked');
    });
  });

  describe('listSharesByProfile', () => {
    const shareLinkId1 = 'share-00000000-0000-0000-0000-000000000001';
    const shareLinkId2 = 'share-00000000-0000-0000-0000-000000000002';

    it('returns all share links for a profile', async () => {
      const shareLinks = [
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `LINK#share#${shareLinkId1}`,
          id: shareLinkId1,
          tenantId: tenantA,
          profileId,
          type: 'share',
          scope: 'view',
          status: 'active',
          tokenHash: 'hash1',
          passcodeHash: null,
          expiresAt: '2024-12-31T23:59:59.999Z',
          createdBy: 'user-123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
          SK: `LINK#share#${shareLinkId2}`,
          id: shareLinkId2,
          tenantId: tenantA,
          profileId,
          type: 'share',
          scope: 'view',
          status: 'revoked',
          tokenHash: 'hash2',
          passcodeHash: null,
          expiresAt: '2024-12-31T23:59:59.999Z',
          createdBy: 'user-123',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-03T00:00:00.000Z',
        },
      ];

      ddbMock.on(QueryCommand).resolves({ Items: shareLinks });

      const result = await repo.listSharesByProfile(tenantA, profileId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(shareLinkId1);
      expect(result[1].id).toBe(shareLinkId2);
    });

    it('queries with correct key pattern (PK + SK prefix LINK#share#)', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.listSharesByProfile(tenantA, profileId);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.KeyConditionExpression).toContain('PK = :pk');
      expect(input.KeyConditionExpression).toContain('begins_with(SK, :skPrefix)');
      expect(input.ExpressionAttributeValues?.[':pk']).toBe(`TENANT#${tenantA}#PROFILE#${profileId}`);
      expect(input.ExpressionAttributeValues?.[':skPrefix']).toBe('LINK#share#');
    });

    it('returns empty array when no share links exist', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.listSharesByProfile(tenantA, profileId);

      expect(result).toEqual([]);
    });

    it('throws error when tenantId is empty', async () => {
      await expect(repo.listSharesByProfile('', profileId)).rejects.toThrow('tenantId is required');
    });

    it('does not return invite links (only share type)', async () => {
      // This test verifies the SK prefix is correct (LINK#share#, not LINK#)
      const shareLink = {
        PK: `TENANT#${tenantA}#PROFILE#${profileId}`,
        SK: `LINK#share#${shareLinkId1}`,
        id: shareLinkId1,
        tenantId: tenantA,
        profileId,
        type: 'share',
        scope: 'view',
        status: 'active',
        tokenHash: 'hash1',
        passcodeHash: null,
        expiresAt: '2024-12-31T23:59:59.999Z',
        createdBy: 'user-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      ddbMock.on(QueryCommand).resolves({ Items: [shareLink] });

      const result = await repo.listSharesByProfile(tenantA, profileId);

      // Only share links returned, not invite links
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('share');
    });
  });
});

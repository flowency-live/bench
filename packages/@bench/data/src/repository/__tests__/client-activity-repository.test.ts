/**
 * ClientActivity repository tests
 *
 * Activity events are stored under the client:
 * - PK = TENANT#{tenantId}#CLIENT#{clientId}
 * - SK = ACTIVITY#{timestamp}#{eventId}
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { createClientActivityRepository } from '../client-activity-repository.js';
import type { ClientActivityRepository } from '../client-activity-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ClientActivityRepository', () => {
  const tableName = 'test-table';
  let repo: ClientActivityRepository;

  const tenantA = 'tenant-a';
  const clientId = 'client-001';
  const contactId = 'contact-001';
  const profileId = 'profile-001';

  beforeEach(() => {
    ddbMock.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
    repo = createClientActivityRepository(
      ddbMock as unknown as DynamoDBDocumentClient,
      tableName,
    );
  });

  describe('log', () => {
    it('creates activity event with timestamp-based SK', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.log(tenantA, {
        clientId,
        contactId,
        contactEmail: 'contact@acme.com',
        profileId,
        eventType: 'view',
      });

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);

      const item = calls[0].args[0].input.Item;
      expect(item?.PK).toBe('TENANT#tenant-a#CLIENT#client-001');
      expect(item?.SK).toMatch(/^ACTIVITY#2026-07-02T12:00:00\.000Z#/);
      expect(item?.eventType).toBe('view');
    });

    it('returns logged activity event', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.log(tenantA, {
        clientId,
        contactId,
        contactEmail: 'contact@acme.com',
        profileId,
        eventType: 'export',
      });

      expect(result.eventType).toBe('export');
      expect(result.clientId).toBe(clientId);
      expect(result.contactId).toBe(contactId);
      expect(result.profileId).toBe(profileId);
      expect(result.tenantId).toBe(tenantA);
      expect(result.id).toMatch(/^activity-/);
    });

    it('supports view event type', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.log(tenantA, {
        clientId,
        contactId,
        contactEmail: 'contact@acme.com',
        profileId,
        eventType: 'view',
      });

      expect(result.eventType).toBe('view');
    });

    it('supports export event type', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.log(tenantA, {
        clientId,
        contactId,
        contactEmail: 'contact@acme.com',
        profileId,
        eventType: 'export',
      });

      expect(result.eventType).toBe('export');
    });
  });

  describe('listByClient', () => {
    it('returns activity events for client (uses ScanIndexForward=false for newest first)', async () => {
      // Mock returns items in the order DynamoDB would with ScanIndexForward=false (newest first)
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'TENANT#tenant-a#CLIENT#client-001',
            SK: 'ACTIVITY#2026-07-02T11:00:00.000Z#activity-002',
            entityType: 'CLIENT_ACTIVITY',
            id: 'activity-002',
            tenantId: tenantA,
            clientId,
            contactId,
            contactEmail: 'contact@acme.com',
            profileId: 'profile-002',
            eventType: 'export',
            createdAt: '2026-07-02T11:00:00.000Z',
          },
          {
            PK: 'TENANT#tenant-a#CLIENT#client-001',
            SK: 'ACTIVITY#2026-07-02T10:00:00.000Z#activity-001',
            entityType: 'CLIENT_ACTIVITY',
            id: 'activity-001',
            tenantId: tenantA,
            clientId,
            contactId,
            contactEmail: 'contact@acme.com',
            profileId,
            eventType: 'view',
            createdAt: '2026-07-02T10:00:00.000Z',
          },
        ],
      });

      const result = await repo.listByClient(tenantA, clientId);

      expect(result).toHaveLength(2);
      // Verify ScanIndexForward is set to false for newest-first ordering
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.ScanIndexForward).toBe(false);
      // Results in order returned by mock (simulating DynamoDB's newest-first)
      expect(result[0].createdAt).toBe('2026-07-02T11:00:00.000Z');
      expect(result[1].createdAt).toBe('2026-07-02T10:00:00.000Z');
    });

    it('returns empty array if no activity', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.listByClient(tenantA, clientId);

      expect(result).toEqual([]);
    });

    it('queries with correct key condition', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.listByClient(tenantA, clientId);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.KeyConditionExpression).toBe(
        'PK = :pk AND begins_with(SK, :skPrefix)',
      );
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ':pk': 'TENANT#tenant-a#CLIENT#client-001',
        ':skPrefix': 'ACTIVITY#',
      });
    });

    it('respects limit parameter', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.listByClient(tenantA, clientId, { limit: 10 });

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.Limit).toBe(10);
    });
  });
});

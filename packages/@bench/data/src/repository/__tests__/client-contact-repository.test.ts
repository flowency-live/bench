/**
 * ClientContact repository tests
 *
 * ClientContact items are scoped to a client within a tenant:
 * - Contact item: PK = TENANT#{tenantId}#CLIENT#{clientId}, SK = CONTACT#{contactId}
 * - GSI1: PK = EMAIL#{email}, SK = CONTACT#{contactId} (for magic link lookup)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createClientContactRepository } from '../client-contact-repository.js';
import type { ClientContactRepository } from '../client-contact-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('ClientContactRepository', () => {
  const tableName = 'test-table';
  let repo: ClientContactRepository;

  const tenantA = 'tenant-a';
  const clientId = 'client-001';

  beforeEach(() => {
    ddbMock.reset();
    repo = createClientContactRepository(ddbMock as unknown as DynamoDBDocumentClient, tableName);
  });

  describe('create', () => {
    it('writes contact item with GSI1 keys', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.create(tenantA, clientId, {
        email: 'contact@acme.com',
        name: 'John Smith',
      });

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);

      const items = calls[0].args[0].input.TransactItems;
      expect(items).toHaveLength(1);

      // Verify GSI1 keys are set for email lookup
      const contactItem = items?.[0].Put?.Item;
      expect(contactItem?.GSI1PK).toBe('EMAIL#contact@acme.com');
    });

    it('returns created contact with all fields', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, clientId, {
        email: 'contact@acme.com',
        name: 'John Smith',
      });

      expect(result.email).toBe('contact@acme.com');
      expect(result.name).toBe('John Smith');
      expect(result.tenantId).toBe(tenantA);
      expect(result.clientId).toBe(clientId);
      expect(result.lastLoginAt).toBeNull();
      expect(result.id).toMatch(/^contact-/);
    });

    it('normalizes email to lowercase', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, clientId, {
        email: 'CONTACT@ACME.COM',
        name: 'John Smith',
      });

      expect(result.email).toBe('contact@acme.com');
    });

    it('trims name', async () => {
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.create(tenantA, clientId, {
        email: 'contact@acme.com',
        name: '  John Smith  ',
      });

      expect(result.name).toBe('John Smith');
    });
  });

  describe('get', () => {
    it('returns contact by ID', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CONTACT#contact-001',
          GSI1PK: 'EMAIL#contact@acme.com',
          GSI1SK: 'CONTACT#contact-001',
          entityType: 'CLIENT_CONTACT',
          id: 'contact-001',
          tenantId: tenantA,
          clientId,
          email: 'contact@acme.com',
          name: 'John Smith',
          lastLoginAt: null,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      });

      const result = await repo.get(tenantA, clientId, 'contact-001');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Smith');
    });

    it('returns null if contact not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repo.get(tenantA, clientId, 'nonexistent');

      expect(result).toBeNull();
    });

    it('returns null if tenantId does not match (defense in depth)', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-b#CLIENT#client-001',
          SK: 'CONTACT#contact-001',
          entityType: 'CLIENT_CONTACT',
          id: 'contact-001',
          tenantId: 'tenant-b', // Different tenant
          clientId,
          email: 'contact@acme.com',
          name: 'John Smith',
          lastLoginAt: null,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      });

      const result = await repo.get(tenantA, clientId, 'contact-001');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('returns contact by email via GSI1 lookup', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'TENANT#tenant-a#CLIENT#client-001',
            SK: 'CONTACT#contact-001',
            GSI1PK: 'EMAIL#contact@acme.com',
            GSI1SK: 'CONTACT#contact-001',
            entityType: 'CLIENT_CONTACT',
            id: 'contact-001',
            tenantId: tenantA,
            clientId,
            email: 'contact@acme.com',
            name: 'John Smith',
            lastLoginAt: null,
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z',
          },
        ],
      });

      const result = await repo.getByEmail('contact@acme.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('contact@acme.com');
      expect(result?.tenantId).toBe(tenantA);
      expect(result?.clientId).toBe(clientId);
    });

    it('normalizes email to lowercase for lookup', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await repo.getByEmail('CONTACT@ACME.COM');

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.ExpressionAttributeValues?.[':pk']).toBe(
        'EMAIL#contact@acme.com',
      );
    });

    it('returns null if email not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.getByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('listByClient', () => {
    it('returns all contacts for client', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: 'TENANT#tenant-a#CLIENT#client-001',
            SK: 'CONTACT#contact-001',
            entityType: 'CLIENT_CONTACT',
            id: 'contact-001',
            tenantId: tenantA,
            clientId,
            email: 'alice@acme.com',
            name: 'Alice',
            lastLoginAt: null,
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z',
          },
          {
            PK: 'TENANT#tenant-a#CLIENT#client-001',
            SK: 'CONTACT#contact-002',
            entityType: 'CLIENT_CONTACT',
            id: 'contact-002',
            tenantId: tenantA,
            clientId,
            email: 'bob@acme.com',
            name: 'Bob',
            lastLoginAt: '2026-07-01T15:00:00.000Z',
            createdAt: '2026-07-01T10:00:00.000Z',
            updatedAt: '2026-07-01T15:00:00.000Z',
          },
        ],
      });

      const result = await repo.listByClient(tenantA, clientId);

      expect(result).toHaveLength(2);
      // Sorted by name
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('returns empty array if no contacts', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await repo.listByClient(tenantA, clientId);

      expect(result).toEqual([]);
    });
  });

  describe('updateLastLogin', () => {
    it('updates lastLoginAt timestamp', async () => {
      ddbMock.on(UpdateCommand).resolves({
        Attributes: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CONTACT#contact-001',
          entityType: 'CLIENT_CONTACT',
          id: 'contact-001',
          tenantId: tenantA,
          clientId,
          email: 'contact@acme.com',
          name: 'John Smith',
          lastLoginAt: '2026-07-02T12:00:00.000Z',
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T12:00:00.000Z',
        },
      });

      const result = await repo.updateLastLogin(tenantA, clientId, 'contact-001');

      expect(result.lastLoginAt).not.toBeNull();

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates contact fields', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CONTACT#contact-001',
          GSI1PK: 'EMAIL#contact@acme.com',
          GSI1SK: 'CONTACT#contact-001',
          entityType: 'CLIENT_CONTACT',
          id: 'contact-001',
          tenantId: tenantA,
          clientId,
          email: 'contact@acme.com',
          name: 'John Smith',
          lastLoginAt: null,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      });
      ddbMock.on(TransactWriteCommand).resolves({});

      const result = await repo.update(tenantA, clientId, 'contact-001', {
        name: 'John D. Smith',
      });

      expect(result.name).toBe('John D. Smith');
    });

    it('throws if contact not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(
        repo.update(tenantA, clientId, 'nonexistent', { name: 'New Name' }),
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('remove', () => {
    it('deletes contact item', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'TENANT#tenant-a#CLIENT#client-001',
          SK: 'CONTACT#contact-001',
          entityType: 'CLIENT_CONTACT',
          id: 'contact-001',
          tenantId: tenantA,
          clientId,
          email: 'contact@acme.com',
          name: 'John Smith',
          lastLoginAt: null,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      });
      ddbMock.on(TransactWriteCommand).resolves({});

      await repo.remove(tenantA, clientId, 'contact-001');

      const calls = ddbMock.commandCalls(TransactWriteCommand);
      expect(calls).toHaveLength(1);
    });

    it('throws if contact not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await expect(repo.remove(tenantA, clientId, 'nonexistent')).rejects.toThrow(
        'Contact not found',
      );
    });
  });
});

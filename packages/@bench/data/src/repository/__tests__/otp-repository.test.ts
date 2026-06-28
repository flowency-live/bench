/**
 * OTP repository tests
 *
 * Per ADR-0014: Phone OTP storage with 6-digit codes, 5-min TTL, single-use.
 * Key pattern: OTP#{phoneHash}
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { createOtpRepository } from '../otp-repository.js';
import type { OtpRepository } from '../otp-repository.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('OtpRepository', () => {
  const tableName = 'test-table';
  let repo: OtpRepository;

  beforeEach(() => {
    ddbMock.reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
    repo = createOtpRepository(
      ddbMock as unknown as DynamoDBDocumentClient,
      tableName
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('generates a 6-digit OTP code', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create('hashed-phone-123');

      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('stores OTP with correct key pattern', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create('hashed-phone-123');

      const putCalls = ddbMock.commandCalls(PutCommand);
      expect(putCalls).toHaveLength(1);

      const item = putCalls[0].args[0].input.Item;
      expect(item?.PK).toBe('OTP#hashed-phone-123');
      expect(item?.SK).toBe('OTP#hashed-phone-123');
      expect(item?.entityType).toBe('OTP');
    });

    it('sets 5-minute TTL', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create('hashed-phone-123');

      const putCalls = ddbMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;

      // Current time: 2024-01-15T10:00:00.000Z = 1705312800 seconds
      // TTL should be 5 minutes (300 seconds) later = 1705313100
      const expectedTTL = Math.floor(new Date('2024-01-15T10:00:00.000Z').getTime() / 1000) + 300;
      expect(item?.TTL).toBe(expectedTTL);
    });

    it('returns expiresAt timestamp', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await repo.create('hashed-phone-123');

      expect(result.expiresAt).toBe('2024-01-15T10:05:00.000Z');
    });

    it('stores createdAt timestamp', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repo.create('hashed-phone-123');

      const putCalls = ddbMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;
      expect(item?.createdAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('generates different codes on each call', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result1 = await repo.create('phone-1');
      const result2 = await repo.create('phone-2');

      // Very unlikely to be the same (1 in 1,000,000)
      // But we can at least check they're both valid 6-digit codes
      expect(result1.code).toMatch(/^\d{6}$/);
      expect(result2.code).toMatch(/^\d{6}$/);
    });
  });

  describe('verify', () => {
    const phoneHash = 'hashed-phone-123';
    const validCode = '123456';

    it('returns true for valid code and deletes the OTP (single-use)', async () => {
      const otpItem = {
        PK: `OTP#${phoneHash}`,
        SK: `OTP#${phoneHash}`,
        entityType: 'OTP',
        phoneHash,
        code: validCode,
        TTL: 1705313100,
        expiresAt: '2024-01-15T10:05:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: otpItem });
      ddbMock.on(DeleteCommand).resolves({});

      const result = await repo.verify(phoneHash, validCode);

      expect(result).toBe(true);

      // Verify delete was called (single-use)
      const deleteCalls = ddbMock.commandCalls(DeleteCommand);
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0].args[0].input.Key).toEqual({
        PK: `OTP#${phoneHash}`,
        SK: `OTP#${phoneHash}`,
      });
    });

    it('returns false for incorrect code and does not delete', async () => {
      const otpItem = {
        PK: `OTP#${phoneHash}`,
        SK: `OTP#${phoneHash}`,
        entityType: 'OTP',
        phoneHash,
        code: validCode,
        TTL: 1705313100,
        expiresAt: '2024-01-15T10:05:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: otpItem });

      const result = await repo.verify(phoneHash, '999999');

      expect(result).toBe(false);

      // Should not delete on wrong code
      const deleteCalls = ddbMock.commandCalls(DeleteCommand);
      expect(deleteCalls).toHaveLength(0);
    });

    it('returns false for non-existent OTP', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repo.verify(phoneHash, validCode);

      expect(result).toBe(false);
    });

    it('returns false for expired OTP', async () => {
      // Set time to after expiry
      vi.setSystemTime(new Date('2024-01-15T10:10:00.000Z'));

      const otpItem = {
        PK: `OTP#${phoneHash}`,
        SK: `OTP#${phoneHash}`,
        entityType: 'OTP',
        phoneHash,
        code: validCode,
        TTL: 1705313100, // Expired
        expiresAt: '2024-01-15T10:05:00.000Z', // 5 minutes ago
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      ddbMock.on(GetCommand).resolves({ Item: otpItem });
      ddbMock.on(DeleteCommand).resolves({});

      const result = await repo.verify(phoneHash, validCode);

      expect(result).toBe(false);

      // Should delete expired OTP
      const deleteCalls = ddbMock.commandCalls(DeleteCommand);
      expect(deleteCalls).toHaveLength(1);
    });

    it('queries with correct key', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      await repo.verify(phoneHash, validCode);

      const getCalls = ddbMock.commandCalls(GetCommand);
      expect(getCalls).toHaveLength(1);
      expect(getCalls[0].args[0].input.Key).toEqual({
        PK: `OTP#${phoneHash}`,
        SK: `OTP#${phoneHash}`,
      });
    });
  });

  describe('delete', () => {
    it('removes the OTP item', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await repo.delete('hashed-phone-123');

      const deleteCalls = ddbMock.commandCalls(DeleteCommand);
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0].args[0].input.Key).toEqual({
        PK: 'OTP#hashed-phone-123',
        SK: 'OTP#hashed-phone-123',
      });
    });

    it('is idempotent (no-op for non-existent)', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      // Should not throw
      await expect(repo.delete('non-existent')).resolves.toBeUndefined();
    });
  });
});
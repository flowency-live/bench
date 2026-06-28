/**
 * Invite claim service tests
 *
 * Per ADR-0014: acceptInvite binds tenant+role, activates user, records identity.
 * This is the "decoupled claim" - sign in by any method, then accept a held invite.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createInviteClaimService } from '../invite-claim.js';
import type { InviteClaimService } from '../invite-claim.js';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('InviteClaimService', () => {
  const tableName = 'test-table';
  let service: InviteClaimService;

  beforeEach(() => {
    ddbMock.reset();
    service = createInviteClaimService(
      ddbMock as unknown as DynamoDBDocumentClient,
      tableName
    );
  });

  describe('acceptInvite', () => {
    const tenantId = 'test-tenant';
    const userId = 'user-123';
    const email = 'alice@example.com';
    const cognitoId = 'cognito-abc-123';

    const activeInviteLookup = {
      id: 'invite-123',
      tenantId,
      profileId: 'profile-456',
      type: 'invite' as const,
      scope: 'edit' as const,
      status: 'active' as const,
      passcodeHash: null,
      expiresAt: '2099-12-31T23:59:59.000Z', // Far future
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const pendingUserItem = {
      PK: `TENANT#${tenantId}#USER#${userId}`,
      SK: `USER#${userId}`,
      GSI1PK: `EMAIL#${email}`,
      GSI1SK: `USER#${userId}`,
      entityType: 'USER',
      id: userId,
      tenantId,
      email,
      name: 'Alice',
      role: 'viewer',
      status: 'pending',
      cognitoId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('activates a pending user and binds identity', async () => {
      // Mock: find user by email
      ddbMock.on(QueryCommand).resolves({ Items: [pendingUserItem] });
      // Mock: get user for bindIdentity
      ddbMock.on(GetCommand).resolves({ Item: pendingUserItem });
      // Mock: transact write for binding
      ddbMock.on(TransactWriteCommand).resolves({});
      // Mock: update invite status
      ddbMock.on(UpdateCommand).resolves({});

      const result = await service.acceptInvite(activeInviteLookup, {
        email,
        cognitoId,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.tenantId).toBe(tenantId);
    });

    it('rejects expired invites', async () => {
      const expiredInvite = {
        ...activeInviteLookup,
        expiresAt: '2020-01-01T00:00:00.000Z', // Past
      };

      const result = await service.acceptInvite(expiredInvite, {
        email,
        cognitoId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invite_expired');
    });

    it('rejects already-used invites', async () => {
      const usedInvite = {
        ...activeInviteLookup,
        status: 'used' as const,
      };

      const result = await service.acceptInvite(usedInvite, {
        email,
        cognitoId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invite_already_used');
    });

    it('rejects revoked invites', async () => {
      const revokedInvite = {
        ...activeInviteLookup,
        status: 'revoked' as const,
      };

      const result = await service.acceptInvite(revokedInvite, {
        email,
        cognitoId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invite_revoked');
    });

    it('returns error if user not found for email', async () => {
      // Mock: no user found
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await service.acceptInvite(activeInviteLookup, {
        email: 'unknown@example.com',
        cognitoId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('user_not_found');
    });

    it('returns error if user belongs to different tenant', async () => {
      const wrongTenantUser = {
        ...pendingUserItem,
        tenantId: 'other-tenant',
      };
      ddbMock.on(QueryCommand).resolves({ Items: [wrongTenantUser] });

      const result = await service.acceptInvite(activeInviteLookup, {
        email,
        cognitoId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('tenant_mismatch');
    });

    it('succeeds for already-active user (idempotent)', async () => {
      const activeUser = {
        ...pendingUserItem,
        status: 'active',
        cognitoId: 'existing-cognito-id',
      };
      ddbMock.on(QueryCommand).resolves({ Items: [activeUser] });
      ddbMock.on(GetCommand).resolves({ Item: activeUser });
      ddbMock.on(TransactWriteCommand).resolves({});
      ddbMock.on(UpdateCommand).resolves({});

      const result = await service.acceptInvite(activeInviteLookup, {
        email,
        cognitoId,
      });

      // Should succeed - idempotent
      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
    });
  });
});

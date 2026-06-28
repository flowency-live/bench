/**
 * Invite Claim Service — ADR-0014 decoupled claim
 *
 * Per ADR-0014: "sign in by any method, then the held invite token binds
 * tenant + role + activates (bindIdentity records the social/cognito id)"
 *
 * This service handles accepting an invite after authentication:
 * 1. Validate the invite is active and not expired
 * 2. Find the user in the tenant by email
 * 3. Bind identity (cognitoId) and activate the user
 * 4. Mark the invite as used (single-use)
 */
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { MagicLinkLookup } from './magic-link-repository.js';
import { emailGSI1PK, tenantPK, userPK, userSK, profilePK, magicLinkSK } from '../keys.js';

/**
 * Identity info for the user accepting the invite
 */
export interface AcceptInviteIdentity {
  /** User's email (must match the invited email) */
  readonly email: string;
  /** Cognito sub / social provider ID (optional for magic-link-only) */
  readonly cognitoId?: string;
  /** Phone hash for phone OTP identity (optional) */
  readonly phoneHash?: string;
}

/**
 * Result of accepting an invite
 */
export type AcceptInviteResult =
  | {
      readonly success: true;
      readonly userId: string;
      readonly tenantId: string;
    }
  | {
      readonly success: false;
      readonly error:
        | 'invite_expired'
        | 'invite_already_used'
        | 'invite_revoked'
        | 'user_not_found'
        | 'tenant_mismatch'
        | 'bind_failed';
    };

/**
 * Invite claim service interface
 */
export interface InviteClaimService {
  /**
   * Accept an invite and bind the user.
   *
   * @param invite - The invite lookup (from MagicLinkRepository.lookupByTokenHash)
   * @param identity - The authenticated user's identity info
   * @returns Result indicating success or failure reason
   */
  acceptInvite(
    invite: MagicLinkLookup,
    identity: AcceptInviteIdentity
  ): Promise<AcceptInviteResult>;
}

/**
 * Create an invite claim service.
 *
 * @param client - DynamoDB Document client
 * @param tableName - DynamoDB table name
 * @returns InviteClaimService instance
 */
export function createInviteClaimService(
  client: DynamoDBDocumentClient,
  tableName: string
): InviteClaimService {
  return {
    async acceptInvite(
      invite: MagicLinkLookup,
      identity: AcceptInviteIdentity
    ): Promise<AcceptInviteResult> {
      // 1. Validate invite status
      if (invite.status === 'used') {
        return { success: false, error: 'invite_already_used' };
      }
      if (invite.status === 'revoked') {
        return { success: false, error: 'invite_revoked' };
      }
      if (invite.status === 'expired') {
        return { success: false, error: 'invite_expired' };
      }

      // 2. Check expiry
      const now = new Date();
      const expiresAt = new Date(invite.expiresAt);
      if (now > expiresAt) {
        return { success: false, error: 'invite_expired' };
      }

      // 3. Find user by email
      const email = identity.email.toLowerCase().trim();
      const userResult = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :email',
          ExpressionAttributeValues: {
            ':email': emailGSI1PK(email),
          },
          Limit: 10, // Multiple tenants might have same email
        })
      );

      const users = userResult.Items ?? [];

      // No user found with this email anywhere
      if (users.length === 0) {
        return { success: false, error: 'user_not_found' };
      }

      // Find the user in this specific tenant
      const user = users.find((u) => u.tenantId === invite.tenantId);

      // User exists but in a different tenant
      if (!user) {
        return { success: false, error: 'tenant_mismatch' };
      }

      const userId = user.id as string;
      const tenantId = invite.tenantId;

      // 5. Get full user item for update
      const fullUserResult = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: userPK(tenantId, userId),
            SK: userSK(userId),
          },
        })
      );

      if (!fullUserResult.Item) {
        return { success: false, error: 'user_not_found' };
      }

      const userItem = fullUserResult.Item;

      // 6. Bind identity and activate (transactional)
      const now_iso = new Date().toISOString();
      const cognitoId = identity.cognitoId ?? userItem.cognitoId ?? null;

      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: [
              // Update user item
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    ...userItem,
                    status: 'active',
                    cognitoId,
                  },
                },
              },
              // Update listing item
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    PK: tenantPK(tenantId),
                    SK: userSK(userId),
                    entityType: 'USER_LISTING',
                    id: userId,
                    tenantId,
                    email: userItem.email,
                    name: userItem.name,
                    role: userItem.role,
                    status: 'active',
                    createdAt: userItem.createdAt,
                  },
                },
              },
            ],
          })
        );

        // 7. Mark invite as used
        await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: {
              PK: profilePK(tenantId, invite.profileId),
              SK: magicLinkSK(invite.type, invite.id),
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :now',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'used',
              ':now': now_iso,
            },
          })
        );

        return {
          success: true,
          userId,
          tenantId,
        };
      } catch {
        return { success: false, error: 'bind_failed' };
      }
    },
  };
}

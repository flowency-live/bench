import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS SDK before importing
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  AdminGetUserCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'AdminGetUser' })),
}));

describe('auth/cognito', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
  });

  describe('getUserSub', () => {
    it('returns the Cognito user sub', async () => {
      mockSend.mockResolvedValueOnce({
        UserAttributes: [
          { Name: 'sub', Value: 'cognito-sub-456' },
          { Name: 'email', Value: 'user@example.com' },
        ],
      });

      const { getUserSub } = await import('../cognito');
      const sub = await getUserSub('user@example.com');

      expect(sub).toBe('cognito-sub-456');
    });

    it('returns null for non-existent user', async () => {
      mockSend.mockRejectedValueOnce({
        name: 'UserNotFoundException',
        message: 'User does not exist.',
      });

      const { getUserSub } = await import('../cognito');
      const sub = await getUserSub('unknown@example.com');

      expect(sub).toBeNull();
    });

    it('normalizes email to lowercase', async () => {
      mockSend.mockResolvedValueOnce({
        UserAttributes: [{ Name: 'sub', Value: 'cognito-sub-789' }],
      });

      const { getUserSub } = await import('../cognito');
      await getUserSub('USER@EXAMPLE.COM');

      const command = mockSend.mock.calls[0][0];
      expect(command.Username).toBe('user@example.com');
    });
  });
});

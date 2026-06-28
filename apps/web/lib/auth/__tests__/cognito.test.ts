import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS SDK before importing
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  AdminCreateUserCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'AdminCreateUser' })),
  AdminSetUserPasswordCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'AdminSetUserPassword' })),
  InitiateAuthCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'InitiateAuth' })),
  ForgotPasswordCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'ForgotPassword' })),
  ConfirmForgotPasswordCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'ConfirmForgotPassword' })),
  AdminGetUserCommand: vi.fn().mockImplementation((params) => ({ ...params, _type: 'AdminGetUser' })),
}));

describe('auth/cognito', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
  });

  describe('signUp', () => {
    it('registers a new user with Cognito admin APIs', async () => {
      // First call: AdminCreateUser
      mockSend.mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: 'sub', Value: 'cognito-user-123' }],
        },
      });
      // Second call: AdminSetUserPassword
      mockSend.mockResolvedValueOnce({});

      const { signUp } = await import('../cognito');
      const result = await signUp('user@example.com', 'SecureP@ss123');

      expect(mockSend).toHaveBeenCalledTimes(2);

      const createCommand = mockSend.mock.calls[0][0];
      expect(createCommand._type).toBe('AdminCreateUser');
      expect(createCommand.Username).toBe('user@example.com');

      const setPasswordCommand = mockSend.mock.calls[1][0];
      expect(setPasswordCommand._type).toBe('AdminSetUserPassword');
      expect(setPasswordCommand.Username).toBe('user@example.com');
      expect(setPasswordCommand.Password).toBe('SecureP@ss123');
      expect(setPasswordCommand.Permanent).toBe(true);

      expect(result.userSub).toBe('cognito-user-123');
      expect(result.userConfirmed).toBe(true);
    });

    it('throws on duplicate email', async () => {
      mockSend.mockRejectedValueOnce({
        name: 'UsernameExistsException',
        message: 'An account with the given email already exists.',
      });

      const { signUp } = await import('../cognito');

      await expect(signUp('existing@example.com', 'Password123!')).rejects.toMatchObject({
        code: 'USER_EXISTS',
      });
    });
  });

  describe('signIn', () => {
    it('authenticates via SRP and returns tokens', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          AccessToken: 'access-token-123',
          IdToken: 'id-token-123',
          RefreshToken: 'refresh-token-123',
        },
      });

      const { signIn } = await import('../cognito');
      const result = await signIn('user@example.com', 'Password123!');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command._type).toBe('InitiateAuth');
      expect(command.AuthFlow).toBe('USER_PASSWORD_AUTH');
      expect(result.accessToken).toBe('access-token-123');
      expect(result.idToken).toBe('id-token-123');
    });

    it('throws on invalid credentials', async () => {
      mockSend.mockRejectedValueOnce({
        name: 'NotAuthorizedException',
        message: 'Incorrect username or password.',
      });

      const { signIn } = await import('../cognito');

      await expect(signIn('user@example.com', 'wrongpassword')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('throws on user not found', async () => {
      mockSend.mockRejectedValueOnce({
        name: 'UserNotFoundException',
        message: 'User does not exist.',
      });

      const { signIn } = await import('../cognito');

      await expect(signIn('unknown@example.com', 'Password123!')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('forgotPassword', () => {
    it('initiates forgot password flow', async () => {
      mockSend.mockResolvedValueOnce({
        CodeDeliveryDetails: {
          Destination: 'u***@example.com',
          DeliveryMedium: 'EMAIL',
        },
      });

      const { forgotPassword } = await import('../cognito');
      const result = await forgotPassword('user@example.com');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command._type).toBe('ForgotPassword');
      expect(result.destination).toBe('u***@example.com');
    });
  });

  describe('confirmForgotPassword', () => {
    it('completes password reset', async () => {
      mockSend.mockResolvedValueOnce({});

      const { confirmForgotPassword } = await import('../cognito');
      await confirmForgotPassword('user@example.com', '123456', 'NewP@ssword123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command._type).toBe('ConfirmForgotPassword');
      expect(command.Username).toBe('user@example.com');
      expect(command.ConfirmationCode).toBe('123456');
      expect(command.Password).toBe('NewP@ssword123');
    });

    it('throws on invalid code', async () => {
      mockSend.mockRejectedValueOnce({
        name: 'CodeMismatchException',
        message: 'Invalid verification code provided.',
      });

      const { confirmForgotPassword } = await import('../cognito');

      await expect(
        confirmForgotPassword('user@example.com', 'wrongcode', 'NewP@ss123'),
      ).rejects.toMatchObject({
        code: 'INVALID_CODE',
      });
    });
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
  });
});

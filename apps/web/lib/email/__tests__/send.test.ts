import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AWS SDK before importing
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  SendEmailCommand: vi.fn().mockImplementation((params) => params),
}));

describe('email/send', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendMagicLinkEmail', () => {
    it('sends email via SES with correct parameters', async () => {
      process.env.NODE_ENV = 'production';
      mockSend.mockResolvedValueOnce({ MessageId: 'test-message-id' });

      const { sendMagicLinkEmail } = await import('../send');

      await sendMagicLinkEmail({
        to: 'user@example.com',
        subject: 'Sign in to Bench',
        verifyUrl: 'https://bench.opstack.uk/auth/verify?token=abc123',
        tenantName: 'Acme Corp',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Source).toBe('noreply@opstack.uk');
      expect(command.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(command.Message.Subject.Data).toBe('Sign in to Bench');
      expect(command.Message.Body.Html.Data).toContain('https://bench.opstack.uk/auth/verify?token=abc123');
      expect(command.Message.Body.Html.Data).toContain('Acme Corp');
    });

    it('skips sending in non-production and logs instead', async () => {
      process.env.NODE_ENV = 'development';
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const { sendMagicLinkEmail } = await import('../send');

      await sendMagicLinkEmail({
        to: 'user@example.com',
        subject: 'Sign in to Bench',
        verifyUrl: 'https://localhost:3000/auth/verify?token=abc123',
        tenantName: 'Test Tenant',
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[email-skip]',
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Sign in to Bench',
        }),
      );

      consoleSpy.mockRestore();
    });

    it('handles SES errors gracefully', async () => {
      process.env.NODE_ENV = 'production';
      mockSend.mockRejectedValueOnce(new Error('SES rate limit exceeded'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { sendMagicLinkEmail } = await import('../send');

      // Should not throw, just log the error
      await expect(
        sendMagicLinkEmail({
          to: 'user@example.com',
          subject: 'Sign in',
          verifyUrl: 'https://bench.opstack.uk/auth/verify?token=abc',
          tenantName: 'Test',
        }),
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[email-error]',
        expect.objectContaining({ error: 'SES rate limit exceeded' }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sendOnboardingEmail', () => {
    it('sends onboarding email with correct content', async () => {
      process.env.NODE_ENV = 'production';
      mockSend.mockResolvedValueOnce({ MessageId: 'test-message-id' });

      const { sendOnboardingEmail } = await import('../send');

      await sendOnboardingEmail({
        to: 'admin@newcorp.com',
        tenantName: 'New Corp',
        verifyUrl: 'https://bench.opstack.uk/auth/verify?token=xyz789',
        invitedBy: 'platform@flowency.co.uk',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Source).toBe('noreply@opstack.uk');
      expect(command.Destination.ToAddresses).toEqual(['admin@newcorp.com']);
      expect(command.Message.Subject.Data).toContain('New Corp');
      expect(command.Message.Body.Html.Data).toContain('https://bench.opstack.uk/auth/verify?token=xyz789');
      expect(command.Message.Body.Html.Data).toContain('New Corp');
    });
  });

  describe('sendConsultantInviteEmail', () => {
    it('sends consultant invite email with correct content', async () => {
      process.env.NODE_ENV = 'production';
      mockSend.mockResolvedValueOnce({ MessageId: 'test-message-id' });

      const { sendConsultantInviteEmail } = await import('../send');

      await sendConsultantInviteEmail({
        to: 'consultant@gmail.com',
        consultantName: 'Jane Smith',
        tenantName: 'Acme Corp',
        inviteUrl: 'https://bench.opstack.uk/invite/abc123',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Source).toBe('noreply@opstack.uk');
      expect(command.Destination.ToAddresses).toEqual(['consultant@gmail.com']);
      expect(command.Message.Subject.Data).toContain('profile');
      expect(command.Message.Body.Html.Data).toContain('Jane Smith');
      expect(command.Message.Body.Html.Data).toContain('Acme Corp');
      expect(command.Message.Body.Html.Data).toContain('https://bench.opstack.uk/invite/abc123');
    });
  });
});

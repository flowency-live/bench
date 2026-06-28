import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
const mockOtpCreate = vi.fn();
const mockOtpVerify = vi.fn();
const mockSnsSend = vi.fn();

vi.mock('@/lib/data/otp', () => ({
  getOtpRepository: () => ({
    create: mockOtpCreate,
    verify: mockOtpVerify,
    delete: vi.fn(),
  }),
}));

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn().mockImplementation(() => ({
    send: mockSnsSend,
  })),
  PublishCommand: vi.fn().mockImplementation((params) => params),
}));

describe('phone-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('requestPhoneOtp', () => {
    it('validates phone number format', async () => {
      const { requestPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', 'invalid');

      const result = await requestPhoneOtp({ step: 'request', ok: false }, formData);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/valid.*phone/i);
    });

    it('creates OTP and sends SMS for valid UK phone number', async () => {
      mockOtpCreate.mockResolvedValueOnce({
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      mockSnsSend.mockResolvedValueOnce({});

      const { requestPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', '+447123456789');

      const result = await requestPhoneOtp({ step: 'request', ok: false }, formData);

      expect(mockOtpCreate).toHaveBeenCalled();
      expect(mockSnsSend).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      expect(result.step).toBe('verify');
      expect(result.phone).toBe('+447123456789');
    });

    it('normalizes UK phone numbers (07 to +447)', async () => {
      mockOtpCreate.mockResolvedValueOnce({
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      mockSnsSend.mockResolvedValueOnce({});

      const { requestPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', '07123456789');

      const result = await requestPhoneOtp({ step: 'request', ok: false }, formData);

      expect(result.ok).toBe(true);
      expect(result.phone).toBe('+447123456789');
    });
  });

  describe('verifyPhoneOtp', () => {
    it('returns error for invalid code format', async () => {
      const { verifyPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', '+447123456789');
      formData.set('code', '12'); // Too short

      const result = await verifyPhoneOtp({ step: 'verify', ok: false, phone: '+447123456789' }, formData);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/6.*digit/i);
    });

    it('returns error for wrong code', async () => {
      mockOtpVerify.mockResolvedValueOnce(false);

      const { verifyPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', '+447123456789');
      formData.set('code', '000000');

      const result = await verifyPhoneOtp({ step: 'verify', ok: false, phone: '+447123456789' }, formData);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/invalid|expired/i);
    });

    it('returns success for valid code', async () => {
      mockOtpVerify.mockResolvedValueOnce(true);

      const { verifyPhoneOtp } = await import('../phone-actions');

      const formData = new FormData();
      formData.set('phone', '+447123456789');
      formData.set('code', '123456');

      const result = await verifyPhoneOtp({ step: 'verify', ok: false, phone: '+447123456789' }, formData);

      expect(mockOtpVerify).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      expect(result.verified).toBe(true);
    });
  });
});

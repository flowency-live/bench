import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/data/oauth-state', () => ({
  getOAuthStateStore: vi.fn(() => ({
    create: vi.fn().mockResolvedValue('mock-state-token'),
    verify: vi.fn().mockResolvedValue({ origin: 'https://example.com' }),
  })),
}));

vi.mock('@/lib/data/user', () => ({
  getUserRepository: vi.fn(() => ({
    getByEmail: vi.fn().mockResolvedValue({
      id: 'user-123',
      tenantId: 'tenant-abc',
      email: 'user@example.com',
      name: 'Test User',
      role: 'admin',
      status: 'active',
      cognitoId: null,
      createdAt: '2026-06-20T09:00:00.000Z',
    }),
  })),
}));

vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch for token exchange
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('social-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /login/auth/google', () => {
    it('redirects to Cognito authorize URL with Google identity provider', async () => {
      const { GET } = await import('../google/route');

      const request = new NextRequest('https://example.com/login/auth/google', {
        headers: { host: 'example.com' },
      });

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('bench-auth.auth.eu-west-2.amazoncognito.com/oauth2/authorize');
      expect(location).toContain('identity_provider=Google');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Flogin%2Fauth%2Fcallback');
    });
  });

  describe('GET /login/auth/apple', () => {
    it('redirects to Cognito authorize URL with Apple identity provider', async () => {
      const { GET } = await import('../apple/route');

      const request = new NextRequest('https://example.com/login/auth/apple', {
        headers: { host: 'example.com' },
      });

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('bench-auth.auth.eu-west-2.amazoncognito.com/oauth2/authorize');
      expect(location).toContain('identity_provider=SignInWithApple');
      expect(location).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Flogin%2Fauth%2Fcallback');
    });
  });

  describe('GET /login/auth/callback', () => {
    beforeEach(() => {
      // Mock successful token exchange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.mock',
        }),
      });
    });

    it('redirects to login with error when OAuth error is present', async () => {
      const { GET } = await import('../callback/route');

      const request = new NextRequest(
        'https://example.com/login/auth/callback?error=access_denied&error_description=User+cancelled',
        { headers: { host: 'example.com' } },
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://example.com/login?error=oauth_error');
    });

    it('redirects to login with error when code or state is missing', async () => {
      const { GET } = await import('../callback/route');

      const request = new NextRequest(
        'https://example.com/login/auth/callback?code=abc123',
        { headers: { host: 'example.com' } },
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://example.com/login?error=missing_params');
    });

    it('redirects to login with error when user not found', async () => {
      const { getUserRepository } = await import('@/lib/data/user');
      vi.mocked(getUserRepository).mockReturnValue({
        getByEmail: vi.fn().mockResolvedValue(null),
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        bindIdentity: vi.fn(),
      });

      const { GET } = await import('../callback/route');

      const request = new NextRequest(
        'https://example.com/login/auth/callback?code=abc123&state=mock-state',
        { headers: { host: 'example.com' } },
      );

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://example.com/login?error=user_not_found');
    });

    it('creates admin session and redirects to dashboard on success', async () => {
      const { createSession } = await import('@/lib/auth/session');
      const { getUserRepository } = await import('@/lib/data/user');

      vi.mocked(getUserRepository).mockReturnValue({
        getByEmail: vi.fn().mockResolvedValue({
          id: 'user-123',
          tenantId: 'tenant-abc',
          email: 'user@example.com',
          name: 'Test User',
          role: 'admin',
          status: 'active',
          cognitoId: null,
          createdAt: '2026-06-20T09:00:00.000Z',
        }),
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        bindIdentity: vi.fn(),
      });

      const { GET } = await import('../callback/route');

      const request = new NextRequest(
        'https://example.com/login/auth/callback?code=abc123&state=mock-state',
        { headers: { host: 'example.com' } },
      );

      const response = await GET(request);

      expect(createSession).toHaveBeenCalledWith({
        kind: 'admin',
        tenantId: 'tenant-abc',
        email: 'user@example.com',
        role: 'owner',
      });
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://example.com/dashboard');
    });
  });
});

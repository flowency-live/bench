import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/data/magic-link', () => ({ getMagicLinkRepository: vi.fn() }));
vi.mock('@/lib/data/user', () => ({ getUserRepository: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ createSession: vi.fn() }));
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn(() => false) }));
vi.mock('@/lib/auth/pending-invite', () => ({
  setPendingInvite: vi.fn(),
  getPendingInvite: vi.fn(),
}));
vi.mock('@/lib/auth/complete-auth', () => ({ completeAuthentication: vi.fn() }));

import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from '@/lib/auth/session';
import { setPendingInvite, getPendingInvite } from '@/lib/auth/pending-invite';
import { completeAuthentication } from '@/lib/auth/complete-auth';

const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();

function wireLinks(lookup: Record<string, unknown>) {
  const markAsUsed = vi.fn().mockResolvedValue(undefined);
  vi.mocked(getMagicLinkRepository).mockReturnValue({
    lookupByTokenHash: vi.fn().mockResolvedValue(lookup),
    findById: vi.fn().mockResolvedValue({ ...lookup, createdBy: 'admin@x.com' }),
    markAsUsed,
  } as unknown as ReturnType<typeof getMagicLinkRepository>);
  return { markAsUsed };
}

function wireUser(user: Record<string, unknown>) {
  vi.mocked(getUserRepository).mockReturnValue({
    getByEmail: vi.fn().mockResolvedValue(user),
  } as unknown as ReturnType<typeof getUserRepository>);
}

function req() {
  return new NextRequest('https://bench.opstack.uk/auth/verify?token=raw-token', {
    headers: { host: 'bench.opstack.uk' },
  });
}

const ADMIN_LOOKUP = {
  id: 'l-signin',
  tenantId: 't1',
  profileId: 'ADMIN',
  scope: 'edit',
  status: 'active',
  expiresAt: future,
};

describe('GET /auth/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('email-tab: a held, matching pending invite is claimed for a still-pending admin', async () => {
    const { markAsUsed } = wireLinks({ ...ADMIN_LOOKUP, type: 'signin' });
    wireUser({ id: 'u1', tenantId: 't1', email: 'admin@x.com', role: 'admin', status: 'pending' });
    vi.mocked(getPendingInvite).mockResolvedValue({
      tenantId: 't1',
      email: 'admin@x.com',
      profileId: 'ADMIN',
      role: 'admin',
      linkId: 'l-invite',
      tokenHash: 'h',
      expiresAt: future,
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    vi.mocked(completeAuthentication).mockResolvedValue({ success: true, redirectTo: '/dashboard' });

    const { GET } = await import('../verify/route');
    const res = await GET(req());

    expect(completeAuthentication).toHaveBeenCalledWith('admin@x.com');
    expect(markAsUsed).toHaveBeenCalledWith('t1', 'ADMIN', 'l-signin');
    expect(createSession).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe('https://bench.opstack.uk/dashboard');
  });

  it('signin link for a returning active admin (no pending invite) mints a session directly', async () => {
    const { markAsUsed } = wireLinks({ ...ADMIN_LOOKUP, type: 'signin' });
    wireUser({ id: 'u1', tenantId: 't1', email: 'admin@x.com', role: 'admin', status: 'active' });
    vi.mocked(getPendingInvite).mockResolvedValue(null);

    const { GET } = await import('../verify/route');
    const res = await GET(req());

    expect(completeAuthentication).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith({
      kind: 'admin',
      tenantId: 't1',
      email: 'admin@x.com',
      role: 'owner',
    });
    expect(markAsUsed).toHaveBeenCalledWith('t1', 'ADMIN', 'l-signin');
    expect(res.headers.get('location')).toBe('https://bench.opstack.uk/dashboard');
  });

  it('invite link never mints a session on GET — it holds the invite and redirects to /login', async () => {
    const { markAsUsed } = wireLinks({ ...ADMIN_LOOKUP, type: 'invite' });
    wireUser({ id: 'u1', tenantId: 't1', email: 'admin@x.com', role: 'admin', status: 'pending' });

    const { GET } = await import('../verify/route');
    const res = await GET(req());

    expect(setPendingInvite).toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(markAsUsed).not.toHaveBeenCalled(); // burn-on-success, not on click
    expect(res.headers.get('location')).toBe('https://bench.opstack.uk/login?pending=admin');
  });
});

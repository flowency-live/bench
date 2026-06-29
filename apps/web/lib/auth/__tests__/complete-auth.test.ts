import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/data/magic-link', () => ({ getMagicLinkRepository: vi.fn() }));
vi.mock('@/lib/data/user', () => ({ getUserRepository: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ createSession: vi.fn() }));
vi.mock('@/lib/auth/pending-invite', () => ({
  getPendingInvite: vi.fn(),
  clearPendingInvite: vi.fn(),
}));

import { completeAuthentication } from '../complete-auth';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getUserRepository } from '@/lib/data/user';
import { createSession } from '@/lib/auth/session';
import { getPendingInvite, clearPendingInvite } from '@/lib/auth/pending-invite';

const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();

function wireUser(user: Record<string, unknown> | null) {
  const setStatus = vi.fn().mockResolvedValue(user);
  vi.mocked(getUserRepository).mockReturnValue({
    getByEmail: vi.fn().mockResolvedValue(user),
    setStatus,
  } as unknown as ReturnType<typeof getUserRepository>);
  return { setStatus };
}

function wireLinks() {
  const markAsUsed = vi.fn().mockResolvedValue(undefined);
  vi.mocked(getMagicLinkRepository).mockReturnValue({
    markAsUsed,
  } as unknown as ReturnType<typeof getMagicLinkRepository>);
  return { markAsUsed };
}

describe('completeAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims a pending admin invite: activates, burns, mints an admin session', async () => {
    vi.mocked(getPendingInvite).mockResolvedValue({
      tenantId: 't1',
      profileId: 'ADMIN',
      role: 'admin',
      tokenHash: 'h',
      linkId: 'l1',
      expiresAt: future,
      email: 'admin@x.com',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const { setStatus } = wireUser({ id: 'u1', tenantId: 't1', email: 'admin@x.com', role: 'admin', status: 'pending' });
    const { markAsUsed } = wireLinks();

    const result = await completeAuthentication('admin@x.com');

    expect(result).toEqual({ success: true, redirectTo: '/dashboard' });
    expect(setStatus).toHaveBeenCalledWith('t1', 'u1', 'active');
    expect(markAsUsed).toHaveBeenCalledWith('t1', 'ADMIN', 'l1');
    expect(createSession).toHaveBeenCalledWith({
      kind: 'admin',
      tenantId: 't1',
      email: 'admin@x.com',
      role: 'owner',
    });
    expect(clearPendingInvite).toHaveBeenCalled();
  });

  it('refuses a NON-admin invite without minting any session (no escalation)', async () => {
    vi.mocked(getPendingInvite).mockResolvedValue({
      tenantId: 't1',
      profileId: 'profile-xyz', // consultant invite, NOT the ADMIN sentinel
      role: 'viewer',
      tokenHash: 'h',
      linkId: 'l1',
      expiresAt: future,
      email: 'consultant@x.com',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const { markAsUsed } = wireLinks();
    wireUser({ id: 'u2', tenantId: 't1', email: 'consultant@x.com', role: 'viewer', status: 'pending' });

    const result = await completeAuthentication('consultant@x.com');

    expect(result.success).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(markAsUsed).not.toHaveBeenCalled();
  });

  it('rejects when the verified email does not match the invite', async () => {
    vi.mocked(getPendingInvite).mockResolvedValue({
      tenantId: 't1',
      profileId: 'ADMIN',
      role: 'admin',
      tokenHash: 'h',
      linkId: 'l1',
      expiresAt: future,
      email: 'invited@x.com',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    wireLinks();
    wireUser({ id: 'u1', tenantId: 't1', email: 'invited@x.com', role: 'admin', status: 'pending' });

    const result = await completeAuthentication('someone-else@x.com');

    expect(result).toEqual({ success: false, error: 'invite_mismatch' });
    expect(createSession).not.toHaveBeenCalled();
    expect(clearPendingInvite).toHaveBeenCalled();
  });

  it('signs in a returning active admin when no invite is pending', async () => {
    vi.mocked(getPendingInvite).mockResolvedValue(null);
    wireUser({ id: 'u1', tenantId: 't1', email: 'admin@x.com', role: 'admin', status: 'active' });

    const result = await completeAuthentication('admin@x.com');

    expect(result).toEqual({ success: true, redirectTo: '/dashboard' });
    expect(createSession).toHaveBeenCalledWith({
      kind: 'admin',
      tenantId: 't1',
      email: 'admin@x.com',
      role: 'owner',
    });
  });

  it('refuses a returning viewer (admin path only)', async () => {
    vi.mocked(getPendingInvite).mockResolvedValue(null);
    wireUser({ id: 'u3', tenantId: 't1', email: 'viewer@x.com', role: 'viewer', status: 'active' });

    const result = await completeAuthentication('viewer@x.com');

    expect(result).toEqual({ success: false, error: 'not_admin' });
    expect(createSession).not.toHaveBeenCalled();
  });
});

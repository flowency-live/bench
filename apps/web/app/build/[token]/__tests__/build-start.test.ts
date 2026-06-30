import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/data/magic-link', () => ({ getMagicLinkRepository: vi.fn() }));
vi.mock('@/lib/data/repository', () => ({ getRepository: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ createSession: vi.fn() }));

import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getRepository } from '@/lib/data/repository';
import { createSession } from '@/lib/auth/session';

const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function wireLinks(lookup: Record<string, unknown> | null) {
  const markAsUsed = vi.fn().mockResolvedValue(undefined);
  vi.mocked(getMagicLinkRepository).mockReturnValue({
    lookupByTokenHash: vi.fn().mockResolvedValue(lookup),
    markAsUsed,
  } as unknown as ReturnType<typeof getMagicLinkRepository>);
  return { markAsUsed };
}

function wireRepo() {
  const create = vi.fn().mockResolvedValue({ id: 'newpid' });
  const setStatus = vi.fn().mockResolvedValue(undefined);
  vi.mocked(getRepository).mockReturnValue({ create, setStatus } as unknown as ReturnType<typeof getRepository>);
  return { create, setStatus };
}

function postReq(body: Record<string, string>) {
  return new NextRequest('https://bench.opstack.uk/build/raw-token/start', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

const BUILDER_LOOKUP = {
  id: 'l1',
  tenantId: 't1',
  profileId: 'BUILDER',
  type: 'invite',
  scope: 'edit',
  status: 'active',
  expiresAt: future,
};

const params = Promise.resolve({ token: 'raw-token' });

describe('POST /build/[token]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a profile, mints a member session, and does NOT burn the reusable link', async () => {
    const { markAsUsed } = wireLinks(BUILDER_LOOKUP);
    const { create, setStatus } = wireRepo();

    const { POST } = await import('../start/route');
    const res = await POST(postReq({ name: 'Priya Nair', email: 'priya@example.com' }), { params });

    expect(create).toHaveBeenCalledWith('t1', { name: 'Priya Nair', email: 'priya@example.com' });
    expect(setStatus).toHaveBeenCalledWith('t1', 'newpid', 'draft');
    expect(createSession).toHaveBeenCalledWith({
      kind: 'member',
      tenantId: 't1',
      profileId: 'newpid',
      scope: 'edit',
    });
    // Reusable link — must stay usable for the next new consultant.
    expect(markAsUsed).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe('https://bench.opstack.uk/profiles/newpid/edit');
  });

  it('rejects invalid name/email back to the form', async () => {
    wireLinks(BUILDER_LOOKUP);
    const { create } = wireRepo();

    const { POST } = await import('../start/route');
    const res = await POST(postReq({ name: 'X', email: 'not-an-email' }), { params });

    expect(create).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/build/raw-token');
  });

  it('rejects a non-builder token (wrong sentinel)', async () => {
    wireLinks({ ...BUILDER_LOOKUP, profileId: 'some-real-profile' });
    const { create } = wireRepo();

    const { POST } = await import('../start/route');
    const res = await POST(postReq({ name: 'Priya Nair', email: 'priya@example.com' }), { params });

    expect(create).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('/build/raw-token');
  });
});

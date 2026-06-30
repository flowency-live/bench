import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/data/repository', () => ({ getRepository: vi.fn() }));
vi.mock('@/lib/data/magic-link', () => ({ getMagicLinkRepository: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  getTenantId: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { sendEditLink } from '../invite-actions';
import { getRepository } from '@/lib/data/repository';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { getSession, getTenantId } from '@/lib/auth/session';

describe('sendEditLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ kind: 'admin' } as never);
    vi.mocked(getTenantId).mockReturnValue('t1');
  });

  it('mints a single-use edit link and returns the /invite path', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'l1' });
    vi.mocked(getMagicLinkRepository).mockReturnValue({ create } as unknown as ReturnType<typeof getMagicLinkRepository>);
    const setStatus = vi.fn();
    vi.mocked(getRepository).mockReturnValue({ setStatus } as unknown as ReturnType<typeof getRepository>);

    const path = await sendEditLink('p1');

    expect(path).toMatch(/^\/invite\/.+/);
    const [tenantArg, input] = create.mock.calls[0];
    expect(tenantArg).toBe('t1');
    expect(input.profileId).toBe('p1');
    expect(input.type).toBe('invite');
    expect(input.scope).toBe('edit');

    // CRITICAL: an edit link must NOT change the profile status — an active
    // (published) profile stays published while the consultant edits it.
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('refuses when not authenticated', async () => {
    vi.mocked(getTenantId).mockReturnValue(null);
    await expect(sendEditLink('p1')).rejects.toThrow();
  });
});

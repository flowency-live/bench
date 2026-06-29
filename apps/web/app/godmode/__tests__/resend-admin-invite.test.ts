import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/platform', () => ({ getPlatformSession: vi.fn() }));
vi.mock('@/lib/data/user', () => ({ getUserRepository: vi.fn() }));
vi.mock('@/lib/data/tenant', () => ({ getTenantRepository: vi.fn() }));
vi.mock('@/lib/data/magic-link', () => ({ getMagicLinkRepository: vi.fn() }));
vi.mock('@/lib/email/send', () => ({ sendOnboardingEmail: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ createSession: vi.fn() }));
vi.mock('@/lib/tenant', () => ({ PILOT_TENANT_ID: 'change-connected' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: () => 'bench.opstack.uk' }),
}));

import { resendAdminInvite } from '../actions';
import { getPlatformSession } from '@/lib/auth/platform';
import { getUserRepository } from '@/lib/data/user';
import { getTenantRepository } from '@/lib/data/tenant';
import { getMagicLinkRepository } from '@/lib/data/magic-link';
import { sendOnboardingEmail } from '@/lib/email/send';

const adminUser = {
  id: 'u1',
  tenantId: 't1',
  email: 'admin@adaptavis.com',
  name: 'Ada Min',
  role: 'admin' as const,
  status: 'pending' as const,
  cognitoId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const tenant = {
  id: 't1',
  name: 'Adaptavis',
  instanceName: 'Adaptavis Talent',
};

function wireRepos(users = [adminUser]) {
  const createLink = vi.fn().mockResolvedValue({ id: 'l1' });
  vi.mocked(getUserRepository).mockReturnValue({
    listByTenant: vi.fn().mockResolvedValue(users),
  } as unknown as ReturnType<typeof getUserRepository>);
  vi.mocked(getTenantRepository).mockReturnValue({
    get: vi.fn().mockResolvedValue(tenant),
  } as unknown as ReturnType<typeof getTenantRepository>);
  vi.mocked(getMagicLinkRepository).mockReturnValue({
    create: createLink,
  } as unknown as ReturnType<typeof getMagicLinkRepository>);
  return { createLink };
}

describe('resendAdminInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects without a platform session', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue(null);

    const result = await resendAdminInvite('t1', 'u1');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/authoris|authoriz/i);
  });

  it('mints a fresh single-use link bound to the admin + tenant, and returns it', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'jason@flowency.co.uk' });
    const { createLink } = wireRepos();

    const result = await resendAdminInvite('t1', 'u1');

    expect(result.ok).toBe(true);
    expect(result.link).toMatch(/^\/auth\/verify\?token=.+/);

    // The link binds THIS admin's email to THIS tenant (claim-time binding).
    expect(createLink).toHaveBeenCalledTimes(1);
    const [tenantArg, input] = createLink.mock.calls[0];
    expect(tenantArg).toBe('t1');
    expect(input.type).toBe('invite');
    expect(input.createdBy).toBe('admin@adaptavis.com|t1');

    // Best-effort email to the bound admin (not the requester).
    expect(sendOnboardingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@adaptavis.com' }),
    );
  });

  it('refuses to issue an admin link to a viewer (no privilege escalation)', async () => {
    vi.mocked(getPlatformSession).mockResolvedValue({ email: 'jason@flowency.co.uk' });
    wireRepos([{ ...adminUser, role: 'viewer' }]);

    const result = await resendAdminInvite('t1', 'u1');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/admin/i);
  });
});

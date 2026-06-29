import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminInviteButton } from '../AdminInviteButton';
import { resendAdminInvite } from '../actions';

vi.mock('../actions', () => ({
  resendAdminInvite: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminInviteButton', () => {
  it('labels the CTA for a pending admin (onboarding)', () => {
    render(
      <AdminInviteButton tenantId="t1" userId="u1" email="a@x.com" status="pending" />,
    );
    expect(screen.getByRole('button', { name: /send invite link/i })).toBeInTheDocument();
  });

  it('labels the CTA for an active admin (sign-in recovery)', () => {
    render(
      <AdminInviteButton tenantId="t1" userId="u1" email="a@x.com" status="active" />,
    );
    expect(screen.getByRole('button', { name: /resend sign-in link/i })).toBeInTheDocument();
  });

  it('generates a link and reveals the share actions', async () => {
    vi.mocked(resendAdminInvite).mockResolvedValue({
      ok: true,
      link: '/auth/verify?token=abc123',
    });
    const user = userEvent.setup();

    render(
      <AdminInviteButton tenantId="t1" userId="u1" email="a@x.com" status="pending" />,
    );
    await user.click(screen.getByRole('button', { name: /send invite link/i }));

    await waitFor(() => {
      expect(resendAdminInvite).toHaveBeenCalledWith('t1', 'u1');
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
    expect((screen.getByLabelText(/invite link/i) as HTMLInputElement).value).toContain(
      '/auth/verify?token=abc123',
    );
  });

  it('surfaces an error when the action fails', async () => {
    vi.mocked(resendAdminInvite).mockResolvedValue({
      ok: false,
      error: 'Tenant not found.',
    });
    const user = userEvent.setup();

    render(
      <AdminInviteButton tenantId="t1" userId="u1" email="a@x.com" status="active" />,
    );
    await user.click(screen.getByRole('button', { name: /resend sign-in link/i }));

    await waitFor(() => {
      expect(screen.getByText(/tenant not found/i)).toBeInTheDocument();
    });
  });
});

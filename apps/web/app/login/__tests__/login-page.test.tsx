import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import LoginPage from '../page';

// Stub the heavy client form (useActionState etc.) — this test is about the
// pre-auth brand chrome, not the form internals.
vi.mock('../LoginForm', () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

vi.mock('@/lib/auth/pending-invite', () => ({
  getPendingInvite: vi.fn().mockResolvedValue(null),
}));

afterEach(() => {
  cleanup();
});

async function renderLogin(searchParams: { error?: string; pending?: string } = {}) {
  const ui = await LoginPage({ searchParams: Promise.resolve(searchParams) });
  render(ui);
}

describe('LoginPage (pre-auth brand)', () => {
  it('shows the Bench platform brand, never Change Connected', async () => {
    await renderLogin();

    // Bench platform wordmark + heading are present...
    expect(screen.getAllByText(/bench/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /sign in to bench/i })).toBeInTheDocument();

    // ...and no tenant (Change Connected) branding leaks onto the generic login.
    expect(screen.queryByAltText(/change connected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/change hub/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connecting is what we do/i)).not.toBeInTheDocument();
  });

  it('renders the sign-in form', async () => {
    await renderLogin();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });
});

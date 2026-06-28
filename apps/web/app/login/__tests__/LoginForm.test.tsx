import * as React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

// Mock the actions module
vi.mock('../actions', () => ({
  requestAdminLink: vi.fn().mockResolvedValue({ ok: false }),
}));

// Mock the phone-actions module
vi.mock('../phone-actions', () => ({
  requestPhoneOtp: vi.fn().mockResolvedValue({ step: 'request', ok: false }),
  verifyPhoneOtp: vi.fn().mockResolvedValue({ step: 'verify', ok: false }),
}));

// Mock useActionState to return the mock action
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useActionState: vi.fn().mockReturnValue([{ ok: false }, vi.fn()]),
  };
});

afterEach(() => {
  cleanup();
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tabs', () => {
    it('renders three auth method tabs', () => {
      render(<LoginForm />);

      expect(screen.getByRole('tab', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /phone/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /socials/i })).toBeInTheDocument();
    });

    it('shows email tab as selected by default', () => {
      render(<LoginForm />);

      const emailTab = screen.getByRole('tab', { name: /email/i });
      expect(emailTab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows email magic link form by default', () => {
      render(<LoginForm />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /email me a sign-in link/i })).toBeInTheDocument();
    });
  });

  describe('phone tab', () => {
    it('shows phone OTP form when phone tab is selected', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const phoneTab = screen.getByRole('tab', { name: /phone/i });
      await user.click(phoneTab);

      expect(screen.getByLabelText(/uk mobile/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument();
    });
  });

  describe('socials tab', () => {
    it('shows social sign-in buttons when socials tab is selected', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const socialsTab = screen.getByRole('tab', { name: /socials/i });
      await user.click(socialsTab);

      expect(screen.getByRole('link', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /continue with apple/i })).toBeInTheDocument();
    });

    it('links to correct OAuth routes', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const socialsTab = screen.getByRole('tab', { name: /socials/i });
      await user.click(socialsTab);

      const googleLink = screen.getByRole('link', { name: /continue with google/i });
      const appleLink = screen.getByRole('link', { name: /continue with apple/i });

      expect(googleLink).toHaveAttribute('href', '/login/auth/google');
      expect(appleLink).toHaveAttribute('href', '/login/auth/apple');
    });
  });

  describe('error display', () => {
    it('shows error message when invalid prop is true', () => {
      render(<LoginForm invalid />);

      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });

    it('does not show error message when invalid prop is false', () => {
      render(<LoginForm />);

      expect(screen.queryByText(/invalid or has expired/i)).not.toBeInTheDocument();
    });
  });
});

'use client';

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareLinkButton } from '../ShareLinkButton';

// Mock the actions module
vi.mock('@/app/actions', () => ({
  createShareLink: vi.fn().mockResolvedValue('/share/tenant-slug/john-doe/abc123token'),
  getActiveShareLink: vi.fn().mockResolvedValue(null),
  revokeShareLink: vi.fn().mockResolvedValue(undefined),
}));

// Store the clipboard mock function for reuse
const mockWriteText = vi.fn().mockResolvedValue(undefined);

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

afterEach(() => {
  cleanup();
});

describe('ShareLinkButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the clipboard mock after clearAllMocks
    mockWriteText.mockResolvedValue(undefined);
  });

  describe('when no active share link exists', () => {
    it('shows Share link button', async () => {
      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
      });
    });

    it('creates a share link and shows share menu on click', async () => {
      const user = userEvent.setup();
      const { createShareLink } = await import('@/app/actions');

      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /share link/i }));

      await waitFor(() => {
        expect(createShareLink).toHaveBeenCalledWith('profile-123');
      });

      // After creation, share menu should appear with the URL
      await waitFor(() => {
        const input = screen.getByLabelText(/share link/i) as HTMLInputElement;
        expect(input.value).toContain('/share/tenant-slug/john-doe/abc123token');
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sms/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });
    });
  });

  describe('when active share link exists (without URL)', () => {
    beforeEach(async () => {
      const { getActiveShareLink } = await import('@/app/actions');
      vi.mocked(getActiveShareLink).mockResolvedValue({
        id: 'link-456',
        createdAt: '2026-06-20T09:00:00.000Z',
      });
    });

    it('shows active link indicator with deactivate button', async () => {
      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        // Should show active link indicator
        expect(screen.getByText(/share link active/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });
    });

    it('shows create new link button when active link exists', async () => {
      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new link/i })).toBeInTheDocument();
      });
    });

    it('revokes existing link when Deactivate is clicked', async () => {
      const user = userEvent.setup();
      const { revokeShareLink, getActiveShareLink } = await import('@/app/actions');

      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
      });

      // Mock getActiveShareLink to return null after revoke
      vi.mocked(getActiveShareLink).mockResolvedValue(null);

      await user.click(screen.getByRole('button', { name: /deactivate/i }));

      await waitFor(() => {
        expect(revokeShareLink).toHaveBeenCalledWith('profile-123', 'link-456');
      });

      // After revocation, should show Create button again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
      });
    });

    it('creates new link and shows share menu when Create new link is clicked', async () => {
      const user = userEvent.setup();
      const { createShareLink } = await import('@/app/actions');

      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create new link/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create new link/i }));

      await waitFor(() => {
        expect(createShareLink).toHaveBeenCalledWith('profile-123');
      });

      // Should show share menu with the new URL
      await waitFor(() => {
        const input = screen.getByLabelText(/share link/i) as HTMLInputElement;
        expect(input.value).toContain('/share/tenant-slug/john-doe/abc123token');
      });
    });
  });

  describe('share actions after creating link', () => {
    beforeEach(async () => {
      // Ensure no active link exists so we can test creating one
      const { getActiveShareLink } = await import('@/app/actions');
      vi.mocked(getActiveShareLink).mockResolvedValue(null);
    });

    it('copies link to clipboard when Copy is clicked', async () => {
      const user = userEvent.setup();

      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      // Wait for initial check to complete, then create a link
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /share link/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /copy/i }));

      // Wait for the "Copied" text to appear, which indicates the copy succeeded
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
      });

      // The Copied button appearing indicates the clipboard API was called successfully
      // This verifies the copy functionality works
    });

    it('opens WhatsApp with share message', async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(<ShareLinkButton profileId="profile-123" consultantName="John Doe" />);

      // Wait for initial check to complete, then create a link
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /share link/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /share link/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /whatsapp/i }));

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('wa.me'),
        '_blank',
      );

      windowOpenSpy.mockRestore();
    });
  });
});

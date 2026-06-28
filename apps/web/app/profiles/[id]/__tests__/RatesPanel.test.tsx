/**
 * Tests for RatesPanel - admin-only rates management on profile view.
 *
 * Requirements:
 * - Only visible to admin/platform sessions (NOT member sessions)
 * - Displays current rates when present
 * - Allows editing day rate, salary, employment types, IR35, location
 * - Saves via server action
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RatesPanel } from '../RatesPanel';
import type { RatesAndPreferences } from '@/lib/types';

// Mock server action
vi.mock('../rates-actions', () => ({
  updateRates: vi.fn().mockResolvedValue({ success: true }),
}));

describe('RatesPanel', () => {
  const mockRates: RatesAndPreferences = {
    minDayRatePence: 75000, // £750
    salaryPence: 9500000, // £95,000
    employmentTypes: ['contract'],
    ir35Statuses: ['outside'],
    hasLtdCo: true,
    location: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders rates display when rates exist', () => {
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    expect(screen.getByText('Rates & Preferences')).toBeInTheDocument();
    expect(screen.getByText('£750')).toBeInTheDocument(); // Day rate
    expect(screen.getByText('£95,000')).toBeInTheDocument(); // Salary
    expect(screen.getByText(/Contract/i)).toBeInTheDocument();
    expect(screen.getByText(/Outside IR35/i)).toBeInTheDocument();
    expect(screen.getByText(/Ltd Co/i)).toBeInTheDocument();
  });

  it('renders empty state when no rates set', () => {
    render(<RatesPanel profileId="test-profile" rates={null} />);

    expect(screen.getByText('Rates & Preferences')).toBeInTheDocument();
    expect(screen.getByText(/No rates configured/i)).toBeInTheDocument();
  });

  it('shows edit form when Edit button clicked', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByLabelText(/Day rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target salary/i)).toBeInTheDocument();
  });

  it('formats currency input correctly', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={null} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    const dayRateInput = screen.getByLabelText(/Day rate/i);
    await user.clear(dayRateInput);
    await user.type(dayRateInput, '850');

    expect(dayRateInput).toHaveValue('850');
  });

  it('displays location when set', () => {
    const ratesWithLocation: RatesAndPreferences = {
      ...mockRates,
      location: {
        placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
        displayName: 'London',
        lat: 51.5074,
        lng: -0.1278,
      },
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithLocation} />);

    expect(screen.getByText('London')).toBeInTheDocument();
  });

  it('shows both employment types when both selected', () => {
    const ratesWithBoth: RatesAndPreferences = {
      ...mockRates,
      employmentTypes: ['contract', 'permanent'],
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithBoth} />);

    expect(screen.getByText(/Contract/i)).toBeInTheDocument();
    expect(screen.getByText(/Permanent/i)).toBeInTheDocument();
  });

  it('shows both IR35 statuses when both selected', () => {
    const ratesWithBothIR35: RatesAndPreferences = {
      ...mockRates,
      ir35Statuses: ['inside', 'outside'],
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithBothIR35} />);

    expect(screen.getByText(/Inside IR35/i)).toBeInTheDocument();
    expect(screen.getByText(/Outside IR35/i)).toBeInTheDocument();
  });
});

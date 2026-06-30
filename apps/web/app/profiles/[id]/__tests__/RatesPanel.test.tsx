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
    outsideIR35RatePence: 75000, // £750
    insideIR35RatePence: 65000, // £650
    salaryPence: 9500000, // £95,000
    employmentTypes: ['contract', 'permanent'],
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
    expect(screen.getByText('£750/day')).toBeInTheDocument(); // Outside IR35 rate
    expect(screen.getByText('£95,000/year')).toBeInTheDocument(); // Salary
    expect(screen.getByText(/Outside IR35/i)).toBeInTheDocument();
    expect(screen.getByText(/Ltd Co/i)).toBeInTheDocument();
  });

  it('renders empty state when no rates set', () => {
    render(<RatesPanel profileId="test-profile" rates={null} />);

    expect(screen.getByText('Rates & Preferences')).toBeInTheDocument();
    expect(screen.getByText(/No rates configured/i)).toBeInTheDocument();
  });

  it('shows grouped rate type sections when Edit button clicked', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Should show rate type groups with checkboxes
    expect(screen.getByText('Outside IR35')).toBeInTheDocument();
    expect(screen.getByText('Inside IR35')).toBeInTheDocument();
    expect(screen.getByText('Permanent')).toBeInTheDocument();
  });

  it('shows day rate input grouped with Outside IR35', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Outside IR35 rate input should be visible (grouped with checkbox)
    const outsideRateInput = screen.getByLabelText(/Day rate/i);
    expect(outsideRateInput).toBeInTheDocument();
    expect(outsideRateInput).toHaveValue('750');
  });

  it('shows target salary input grouped with Permanent', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Permanent should already be checked based on mockRates
    expect(screen.getByLabelText(/Target salary/i)).toBeInTheDocument();
  });

  it('formats currency input correctly', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

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

  it('shows Permanent rate when permanent employment type selected', () => {
    const ratesWithPermanent: RatesAndPreferences = {
      outsideIR35RatePence: null,
      insideIR35RatePence: null,
      salaryPence: 9500000,
      employmentTypes: ['permanent'],
      ir35Statuses: [],
      hasLtdCo: false,
      location: null,
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithPermanent} />);

    expect(screen.getByText(/Permanent/i)).toBeInTheDocument();
    expect(screen.getByText('£95,000/year')).toBeInTheDocument();
  });

  it('shows both IR35 rates when both selected', () => {
    const ratesWithBothIR35: RatesAndPreferences = {
      ...mockRates,
      ir35Statuses: ['inside', 'outside'],
      insideIR35RatePence: 65000,
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithBothIR35} />);

    expect(screen.getByText(/Inside IR35/i)).toBeInTheDocument();
    expect(screen.getByText(/Outside IR35/i)).toBeInTheDocument();
    expect(screen.getByText('£750/day')).toBeInTheDocument(); // Outside rate
    expect(screen.getByText('£650/day')).toBeInTheDocument(); // Inside rate
  });

  it('shows Ltd Co only with Outside IR35', async () => {
    const user = userEvent.setup();
    const ratesInsideOnly: RatesAndPreferences = {
      outsideIR35RatePence: null,
      insideIR35RatePence: 65000,
      salaryPence: null,
      employmentTypes: ['contract'],
      ir35Statuses: ['inside'],
      hasLtdCo: false,
      location: null,
    };
    render(<RatesPanel profileId="test-profile" rates={ratesInsideOnly} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Ltd Co checkbox should NOT be visible when only Inside IR35 is selected
    expect(screen.queryByText('Has Ltd Co')).not.toBeInTheDocument();
  });
});

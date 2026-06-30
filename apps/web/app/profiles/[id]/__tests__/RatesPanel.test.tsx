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
    expect(screen.getByText('£750/day')).toBeInTheDocument(); // Day rate
    expect(screen.getByText('£95,000/year')).toBeInTheDocument(); // Salary
    // Use getAllByText since text appears both in rate row and badge
    expect(screen.getAllByText(/Outside IR35/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ltd Co/i).length).toBeGreaterThan(0);
  });

  it('renders empty state when no rates set', () => {
    render(<RatesPanel profileId="test-profile" rates={null} />);

    expect(screen.getByText('Rates & Preferences')).toBeInTheDocument();
    expect(screen.getByText(/No rates configured/i)).toBeInTheDocument();
  });

  it('shows rate type selection when Edit button clicked', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Should show rate type selection checkboxes
    expect(screen.getByText('Outside IR35')).toBeInTheDocument();
    expect(screen.getByText('Inside IR35')).toBeInTheDocument();
    expect(screen.getByText('Permanent')).toBeInTheDocument();
  });

  it('shows day rate input when Outside IR35 is selected', async () => {
    const user = userEvent.setup();
    render(<RatesPanel profileId="test-profile" rates={mockRates} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Outside IR35 should already be checked based on mockRates
    expect(screen.getByLabelText(/Day rate/i)).toBeInTheDocument();
  });

  it('shows target salary input when Permanent is selected', async () => {
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

  it('shows Permanent badge when permanent employment type selected', () => {
    const ratesWithPermanent: RatesAndPreferences = {
      minDayRatePence: null,
      salaryPence: 9500000,
      employmentTypes: ['permanent'],
      ir35Statuses: [],
      hasLtdCo: false,
      location: null,
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithPermanent} />);

    // Use getAllByText since Permanent appears in both rate row and badge
    expect(screen.getAllByText(/Permanent/i).length).toBeGreaterThan(0);
  });

  it('shows both IR35 statuses when both selected', () => {
    const ratesWithBothIR35: RatesAndPreferences = {
      ...mockRates,
      ir35Statuses: ['inside', 'outside'],
    };
    render(<RatesPanel profileId="test-profile" rates={ratesWithBothIR35} />);

    // Use getAllByText since text appears in multiple places
    expect(screen.getAllByText(/Inside IR35/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Outside IR35/i).length).toBeGreaterThan(0);
  });

  it('shows Ltd Co checkbox only when Outside IR35 is selected', async () => {
    const user = userEvent.setup();
    const ratesInsideOnly: RatesAndPreferences = {
      ...mockRates,
      ir35Statuses: ['inside'],
      hasLtdCo: false,
    };
    render(<RatesPanel profileId="test-profile" rates={ratesInsideOnly} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Ltd Co checkbox should NOT be visible when only Inside IR35 is selected
    expect(screen.queryByText('Has Ltd Co')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProfileRenderer } from '../ProfileRenderer';
import type { Profile } from '@/lib/types';
import type { Tenant } from '@bench/types';

afterEach(() => {
  cleanup();
});

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    tenantId: 't1',
    name: 'Priya Nair',
    email: 'priya@example.com',
    role: 'Change & Transformation Lead',
    status: 'active',
    availability: { status: 'available' },
    ratesAndPreferences: null,
    headline: 'Delivery that sticks',
    bio: 'Twenty years turning strategy into outcomes.',
    headshotUrl: null,
    skills: [],
    stories: [],
    testimonial: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    name: 'Adaptavis',
    instanceName: 'Adaptavis Talent',
    slug: 'adaptavis',
    brandTokens: {
      bgPrimary: '#0b1020',
      bgPanel: '#141a2e',
      accent: '#5e44e4',
      textPrimary: '#ffffff',
      textSecondary: '#a0a8bd',
      fontDisplay: 'Plus Jakarta Sans',
      fontBody: 'Plus Jakarta Sans',
      logoAssetId: null,
    },
    customDomain: null,
    status: 'active',
    trialEndsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProfileRenderer', () => {
  it('renders the tenant brand, never hardcoded Change Connected', () => {
    render(<ProfileRenderer profile={makeProfile()} tenant={makeTenant()} />);

    // The tenant's own instance name appears (eyebrow + footer wordmark)...
    expect(screen.getAllByText(/adaptavis talent/i).length).toBeGreaterThan(0);
    // ...and the Change Connected tenant must NOT leak into another tenant's page.
    expect(screen.queryByText(/change connected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/change maker/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/change connected/i)).not.toBeInTheDocument();
  });

  it('falls back to a neutral Bench mark when no tenant is supplied', () => {
    render(<ProfileRenderer profile={makeProfile()} tenant={null} />);

    expect(screen.queryByText(/change connected/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/bench/i).length).toBeGreaterThan(0);
  });

  it('still renders the consultant content', () => {
    render(<ProfileRenderer profile={makeProfile()} tenant={makeTenant()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: /priya nair/i }),
    ).toBeInTheDocument();
  });
});

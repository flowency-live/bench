import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationAutocomplete } from '../LocationAutocomplete';
import type { ProfileLocation } from '@/lib/types';

// Mock Google Maps API
const mockAutocomplete = {
  addListener: vi.fn(),
  getPlace: vi.fn(),
};

const mockAutocompleteConstructor = vi.fn(() => mockAutocomplete);

beforeAll(() => {
  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      places: {
        Autocomplete: mockAutocompleteConstructor,
      },
    },
  };
});

afterAll(() => {
  delete (globalThis as unknown as { google?: unknown }).google;
});

describe('LocationAutocomplete', () => {
  it('renders with placeholder when value is null', () => {
    render(<LocationAutocomplete value={null} onChange={() => {}} placeholder="Enter city" />);
    expect(screen.getByPlaceholderText('Enter city')).toBeInTheDocument();
  });

  it('displays selected location displayName', () => {
    const location: ProfileLocation = {
      placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
      displayName: 'Manchester, UK',
      lat: 53.4808,
      lng: -2.2426,
    };
    render(<LocationAutocomplete value={location} onChange={() => {}} />);
    expect(screen.getByDisplayValue('Manchester, UK')).toBeInTheDocument();
  });

  it('shows clear button when location is selected', () => {
    const location: ProfileLocation = {
      placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
      displayName: 'Manchester, UK',
      lat: 53.4808,
      lng: -2.2426,
    };
    render(<LocationAutocomplete value={location} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls onChange with null when clear button clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const location: ProfileLocation = {
      placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
      displayName: 'Manchester, UK',
      lat: 53.4808,
      lng: -2.2426,
    };
    render(<LocationAutocomplete value={location} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders with label when provided', () => {
    render(<LocationAutocomplete value={null} onChange={() => {}} label="Location" />);
    expect(screen.getByText('Location')).toBeInTheDocument();
  });
});

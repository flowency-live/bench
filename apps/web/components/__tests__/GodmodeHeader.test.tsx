import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GodmodeHeader } from '../GodmodeHeader';

afterEach(() => {
  cleanup();
});

describe('GodmodeHeader', () => {
  it('renders the Flowency wordmark, not the Change Connected logo', () => {
    render(<GodmodeHeader email="jason@flowency.co.uk" />);

    // Flowency control-plane brand is present...
    expect(screen.getByRole('img', { name: /flowency/i })).toBeInTheDocument();
    // ...and the Change Connected tenant logo is NOT.
    expect(screen.queryByAltText(/change connected/i)).not.toBeInTheDocument();
  });

  it('shows the Bench product name and Godmode context', () => {
    render(<GodmodeHeader email="jason@flowency.co.uk" />);

    expect(screen.getByText('Bench')).toBeInTheDocument();
    expect(screen.getByText(/godmode/i)).toBeInTheDocument();
  });

  it('surfaces who is signed in and a way out', () => {
    render(<GodmodeHeader email="jason@flowency.co.uk" />);

    expect(screen.getByText('jason@flowency.co.uk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign out/i })).toHaveAttribute(
      'href',
      '/auth/logout',
    );
  });
});

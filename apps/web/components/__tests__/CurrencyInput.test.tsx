import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyInput } from '../CurrencyInput';

afterEach(() => {
  cleanup();
});

describe('CurrencyInput', () => {
  it('renders with placeholder when value is null', () => {
    render(<CurrencyInput value={null} onChange={() => {}} placeholder="Enter rate" />);
    expect(screen.getByPlaceholderText('Enter rate')).toBeInTheDocument();
  });

  it('displays value in pounds format (pence to pounds)', () => {
    render(<CurrencyInput value={75000} onChange={() => {}} />);
    expect(screen.getByDisplayValue('750.00')).toBeInTheDocument();
  });

  it('displays value with thousand separators', () => {
    render(<CurrencyInput value={12500000} onChange={() => {}} />);
    expect(screen.getByDisplayValue('125,000.00')).toBeInTheDocument();
  });

  it('calls onChange with pence value on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CurrencyInput value={null} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '750');
    await user.tab(); // blur

    expect(onChange).toHaveBeenCalledWith(75000);
  });

  it('handles decimal input correctly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CurrencyInput value={null} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '750.50');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(75050);
  });

  it('calls onChange with null when input is cleared', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CurrencyInput value={75000} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows £ prefix', () => {
    render(<CurrencyInput value={75000} onChange={() => {}} />);
    expect(screen.getByText('£')).toBeInTheDocument();
  });

  it('renders with label when provided', () => {
    render(<CurrencyInput value={null} onChange={() => {}} label="Day Rate" />);
    expect(screen.getByText('Day Rate')).toBeInTheDocument();
  });
});

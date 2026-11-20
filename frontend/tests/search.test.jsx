import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from '../src/components/SearchBar.jsx';

const places = [
  { id: 'p1', name: 'Shell Station', label: 'Shell Station, Main St, Springfield', category: 'petrol_station', lat: 1, lng: 2 },
  { id: 'p2', name: 'Springfield Mall', label: 'Springfield Mall, Springfield', category: 'shopping', lat: 3, lng: 4 },
];

describe('destination search', () => {
  it('shows suggestions while typing and selects a destination', async () => {
    const search = vi.fn(async () => places);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar search={search} onSelect={onSelect} near={{ lat: 9, lng: 9 }} />);

    await user.type(screen.getByRole('combobox'), 'spring');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(search).toHaveBeenLastCalledWith('spring', expect.objectContaining({ near: { lat: 9, lng: 9 } }));

    await user.click(screen.getByText('Springfield Mall'));
    expect(onSelect).toHaveBeenCalledWith(places[1]);
    expect(screen.getByRole('combobox')).toHaveValue('Springfield Mall');
  });

  it('supports keyboard selection', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar search={async () => places} onSelect={onSelect} />);
    await user.type(screen.getByRole('combobox'), 'shell');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(places[1]);
  });

  it('debounces requests', async () => {
    const search = vi.fn(async () => places);
    const user = userEvent.setup();
    render(<SearchBar search={search} />);
    await user.type(screen.getByRole('combobox'), 'springfield');
    await screen.findAllByRole('option');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('explains when nothing is found', async () => {
    const user = userEvent.setup();
    render(<SearchBar search={async () => []} />);
    await user.type(screen.getByRole('combobox'), 'qwxzv');
    expect(await screen.findByText(/No places found for “qwxzv”/)).toBeInTheDocument();
  });

  it('shows search errors', async () => {
    const user = userEvent.setup();
    render(<SearchBar search={async () => Promise.reject(new Error('The map service is busy.'))} />);
    await user.type(screen.getByRole('combobox'), 'paris');
    expect(await screen.findByRole('alert')).toHaveTextContent('The map service is busy.');
  });

  it('clears the search', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar search={async () => places} onClear={onClear} selectedLabel="Springfield Mall" />);
    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(onClear).toHaveBeenCalled();
  });

  it('shows saved places when focused and empty', async () => {
    const user = userEvent.setup();
    const quickPicks = [{ id: 'saved:1', name: 'Home', category: 'home', lat: 1, lng: 1 }];
    render(<SearchBar search={vi.fn()} quickPicks={quickPicks} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Your places')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /home/i })).toBeInTheDocument();
  });

  it('searches only on Enter when the provider forbids autocomplete', async () => {
    const search = vi.fn(async () => places);
    const user = userEvent.setup();
    render(<SearchBar search={search} autocomplete={false} />);
    await user.type(screen.getByRole('combobox'), 'springfield');
    await new Promise((r) => setTimeout(r, 450));
    expect(search).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  });
});

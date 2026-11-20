import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SavedPlaces, { navigateHref } from '../src/pages/dashboard/SavedPlaces.jsx';
import { ToastProvider } from '../src/contexts/ToastContext.jsx';

const saved = [
  { id: 's2', location_name: 'Gym', category: 'favorite', address: '1 Fit St', latitude: 1, longitude: 2 },
  { id: 's1', location_name: 'Home', category: 'home', address: '2 Home Rd', latitude: 3, longitude: 4 },
];

const renderSaved = (service) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <SavedPlaces service={service} />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('saved locations', () => {
  it('lists saved places with Home first and navigation links', async () => {
    renderSaved({ listSavedLocations: vi.fn(async () => saved) });
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Home')).toBeInTheDocument();
    expect(within(items[1]).getByText('Gym')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Navigate to Gym' })).toHaveAttribute('href', '/?dest=1%2C2&name=Gym&label=1+Fit+St');
  });

  it('deletes a saved place', async () => {
    const service = { listSavedLocations: vi.fn(async () => saved), deleteSavedLocation: vi.fn(async () => null) };
    const user = userEvent.setup();
    renderSaved(service);
    await user.click(await screen.findByRole('button', { name: 'Delete Gym' }));
    expect(service.deleteSavedLocation).toHaveBeenCalledWith('s2');
    await waitFor(() => expect(screen.queryByText('Gym')).not.toBeInTheDocument());
  });

  it('shows an empty state', async () => {
    renderSaved({ listSavedLocations: vi.fn(async () => []) });
    expect(await screen.findByText(/no saved places yet/i)).toBeInTheDocument();
  });

  it('shows load errors', async () => {
    renderSaved({ listSavedLocations: vi.fn(async () => Promise.reject(new Error('Please sign in to continue.'))) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in to continue.');
  });

  it('builds navigation links from coordinates', () => {
    expect(navigateHref({ name: 'Work', lat: 51.5, lng: -0.12 })).toBe('/?dest=51.5%2C-0.12&name=Work');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  bearingDelta,
  leafletLikeBounds,
  lngLatBoundsOf,
  routeFeatures,
  toLeafletZoom,
  toMapLibrePadding,
  toMapLibreZoom,
  webglSupported,
} from '../src/maps/map3d/helpers.js';
import { bearingBetween } from '../src/utils/geo.js';
import MapModeControl from '../src/components/MapModeControl.jsx';

describe('3D map helpers', () => {
  it('converts between Leaflet and MapLibre zoom levels', () => {
    expect(toMapLibreZoom(16)).toBe(15);
    expect(toLeafletZoom(15)).toBe(16);
  });

  it('converts Leaflet fitBounds padding to MapLibre padding', () => {
    expect(toMapLibrePadding({ padding: [60, 60], paddingTopLeft: [420, 80] })).toEqual({ top: 80, left: 420, right: 60, bottom: 60 });
    expect(toMapLibrePadding({ padding: [10, 20] })).toEqual({ top: 20, left: 10, right: 10, bottom: 20 });
  });

  it('computes [lng,lat] bounds from [lat,lng] points', () => {
    expect(lngLatBoundsOf([[3.1, 101.7], [3.2, 101.6], [3.15, 101.75]])).toEqual([
      [101.6, 3.1],
      [101.75, 3.2],
    ]);
  });

  it('wraps MapLibre bounds in the Leaflet-style API the app expects', () => {
    const b = leafletLikeBounds({ getSouthWest: () => ({ lat: 3, lng: 101 }), getNorthEast: () => ({ lat: 4, lng: 102 }) });
    expect(b.getSouthWest()).toEqual({ lat: 3, lng: 101 });
    expect(b.getCenter()).toEqual({ lat: 3.5, lng: 101.5 });
  });

  it('builds route GeoJSON with the selected route on top and the travelled part', () => {
    const routes = [
      { id: 'a', geometry: [[3.1, 101.7], [3.2, 101.8]] },
      { id: 'b', geometry: [[3.1, 101.7], [3.15, 101.75]] },
    ];
    const fc = routeFeatures(routes, 'a', [[3.1, 101.7], [3.12, 101.72]]);
    expect(fc.features.map((f) => [f.properties.id, f.properties.selected, f.properties.kind])).toEqual([
      ['b', false, 'route'],
      ['a', true, 'route'],
      ['traveled', true, 'traveled'],
    ]);
    expect(fc.features[1].geometry.coordinates[0]).toEqual([101.7, 3.1]); // GeoJSON is [lng, lat]
  });

  it('computes compass bearings and their shortest difference', () => {
    expect(bearingBetween([3, 101], [3.01, 101])).toBeCloseTo(0, 0); // due north
    expect(bearingBetween([3, 101], [3, 101.01])).toBeCloseTo(90, 0); // due east
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(10, 350)).toBe(-20);
  });

  it('reports WebGL as unavailable in environments without it', () => {
    // jsdom has no WebGL, like some older devices.
    expect(webglSupported()).toBe(false);
  });
});

describe('2D/3D control', () => {
  it('shows the current mode and toggles it', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<MapModeControl is3D={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to 3D map' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('2D');
    await user.click(button);
    expect(onToggle).toHaveBeenCalled();

    rerender(<MapModeControl is3D onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Switch to 2D map' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a reset-to-north compass only when the 3D map is rotated', async () => {
    const onResetNorth = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<MapModeControl is3D bearing={0} onToggle={vi.fn()} onResetNorth={onResetNorth} />);
    expect(screen.queryByRole('button', { name: /north/i })).not.toBeInTheDocument();
    rerender(<MapModeControl is3D bearing={47} onToggle={vi.fn()} onResetNorth={onResetNorth} />);
    await user.click(screen.getByRole('button', { name: 'Reset map to north' }));
    expect(onResetNorth).toHaveBeenCalled();
    rerender(<MapModeControl is3D={false} bearing={47} onToggle={vi.fn()} onResetNorth={onResetNorth} />);
    expect(screen.queryByRole('button', { name: /north/i })).not.toBeInTheDocument();
  });
});

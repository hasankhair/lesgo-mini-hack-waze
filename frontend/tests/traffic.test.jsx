import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { clampBbox, routeBbox, useTrafficIncidents } from '../src/hooks/useTrafficIncidents.js';
import { incidentAsReport, isMapMarker, isNotable } from '../src/reports/incidents.js';
import IncidentPopup from '../src/reports/IncidentPopup.jsx';
import { incidentIcon } from '../src/maps/markerIcons.js';
import { useGuidance } from '../src/navigation/useGuidance.js';
import { computeProgress, prepareRoute } from '../src/navigation/navigationEngine.js';

const incident = (overrides = {}) => ({
  id: 'TTI-1',
  category: 'roadblock',
  label: 'Road closed',
  description: 'Closed',
  severity: 'undefined',
  from: 'Jalan A',
  to: 'Jalan B',
  delaySeconds: 420,
  lengthMeters: 900,
  roadNumbers: ['E12'],
  startTime: new Date(Date.now() - 20 * 60e3).toISOString(),
  latitude: 3.115,
  longitude: 101.7001,
  geometry: [[3.115, 101.7001]],
  ...overrides,
});

describe('traffic area helpers', () => {
  it('leaves small areas alone and shrinks large ones under the API limit', () => {
    expect(clampBbox('101.69,3.14,101.71,3.16')).toBe('101.69,3.14,101.71,3.16');
    const clamped = clampBbox('101,3,102,4').split(',').map(Number);
    const area = (clamped[3] - clamped[1]) * 111.32 * (clamped[2] - clamped[0]) * 111.32 * Math.cos((3.5 * Math.PI) / 180);
    expect(area).toBeLessThanOrEqual(9001);
    expect((clamped[0] + clamped[2]) / 2).toBeCloseTo(101.5, 3); // same centre
  });

  it('builds a padded bbox around a route', () => {
    expect(routeBbox([[3.1, 101.7], [3.12, 101.706]])).toBe('101.6950,3.0950,101.7110,3.1250');
    expect(routeBbox([])).toBeNull();
  });
});

describe('which incidents are shown', () => {
  it('shows closures, accidents and roadworks but only major jams', () => {
    expect(isNotable(incident())).toBe(true);
    expect(isNotable(incident({ category: 'construction' }))).toBe(true);
    expect(isNotable(incident({ category: 'traffic_jam', severity: 'moderate' }))).toBe(false);
    expect(isNotable(incident({ category: 'traffic_jam', severity: 'major' }))).toBe(true);
  });

  it('leaves jams to the road colours instead of map markers', () => {
    expect(isMapMarker(incident({ category: 'traffic_jam', severity: 'major' }))).toBe(false);
    expect(isMapMarker(incident({ category: 'construction' }))).toBe(true);
    expect(isMapMarker(incident())).toBe(true);
  });

  it('marks incidents as official when used for navigation alerts', () => {
    expect(incidentAsReport(incident())).toMatchObject({ id: 'official:TTI-1', report_type: 'roadblock', label: 'Road closed', official: true });
  });
});

describe('useTrafficIncidents', () => {
  it('loads incidents for the area and refreshes them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const list = vi.fn(async () => [incident()]);
      const { result } = renderHook(() => useTrafficIncidents({ bbox: '101.69,3.14,101.71,3.16', enabled: true, list, refreshMs: 1000 }));
      await waitFor(() => expect(result.current).toHaveLength(1));
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing when disabled', () => {
    const list = vi.fn();
    const { result } = renderHook(() => useTrafficIncidents({ bbox: '101,3,101.1,3.1', enabled: false, list }));
    expect(list).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('keeps the last incidents when a refresh fails', async () => {
    const list = vi.fn().mockResolvedValueOnce([incident()]).mockRejectedValueOnce(new Error('quota'));
    const { result, rerender } = renderHook(({ bbox }) => useTrafficIncidents({ bbox, enabled: true, list }), {
      initialProps: { bbox: '101.69,3.14,101.71,3.16' },
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
    rerender({ bbox: '101.70,3.14,101.72,3.16' });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(result.current).toHaveLength(1);
  });
});

describe('official incident display', () => {
  it('labels the source and shows delay, road and extent', () => {
    render(<IncidentPopup incident={incident()} />);
    expect(screen.getByText('Road closed')).toBeInTheDocument();
    expect(screen.getByText(/Official traffic data · TomTom/)).toBeInTheDocument();
    expect(screen.getByText('E12')).toBeInTheDocument();
    expect(screen.getByText('+7 min delay')).toBeInTheDocument();
    expect(screen.getByText('900 m affected')).toBeInTheDocument();
    expect(screen.getByText('Started 20 min ago')).toBeInTheDocument();
  });

  it('uses a distinct square marker', () => {
    const html = incidentIcon('roadblock').options.html;
    expect(html).toContain('aria-label="Official: Roadblock"');
    expect(html).toContain('border-radius:8px');
  });

  it('announces official incidents as fact, not as reports', () => {
    const prepared = prepareRoute({
      distance: 2900,
      duration: 300,
      geometry: [[3.1, 101.7], [3.12, 101.7], [3.12, 101.706]],
      steps: [
        { instruction: 'Head north', type: 'depart', location: [3.1, 101.7] },
        { instruction: 'Turn right', type: 'turn', location: [3.12, 101.7] },
        { instruction: 'Arrive', type: 'arrive', location: [3.12, 101.706] },
      ],
    });
    const speak = vi.fn();
    renderHook(() =>
      useGuidance({
        speak,
        active: true,
        prepared,
        rerouting: false,
        reports: [incidentAsReport(incident())],
        progress: computeProgress(prepared, { lat: 3.108, lng: 101.7, accuracy: 5 }),
      }),
    );
    expect(speak).toHaveBeenCalledWith('Road closed ahead, in 800 metres.', undefined);
  });
});

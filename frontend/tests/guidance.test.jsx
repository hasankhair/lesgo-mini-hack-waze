import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextAnnouncement, spokenDistance } from '../src/navigation/voiceGuidance.js';
import { reportsAlongRoute, upcomingReports } from '../src/navigation/reportsAhead.js';
import { computeProgress, prepareRoute } from '../src/navigation/navigationEngine.js';
import { useGuidance } from '../src/navigation/useGuidance.js';
import { useWakeLock } from '../src/hooks/useWakeLock.js';

// Straight 2.2 km route due north, then a right turn, then arrival.
const route = {
  distance: 2900,
  duration: 300,
  geometry: [
    [3.1, 101.7],
    [3.11, 101.7],
    [3.12, 101.7],
    [3.12, 101.706],
  ],
  steps: [
    { instruction: 'Head north on Jalan Ampang', type: 'depart', location: [3.1, 101.7] },
    { instruction: 'Turn right onto Jalan Tun Razak', type: 'turn', modifier: 'right', location: [3.12, 101.7] },
    { instruction: 'Arrive at your destination', type: 'arrive', location: [3.12, 101.706] },
  ],
};
const prepared = prepareRoute(route);
const at = (lat, lng = 101.7) => computeProgress(prepared, { lat, lng, accuracy: 5 });

const report = (id, lat, lng, type = 'accident') => ({
  id,
  report_type: type,
  latitude: lat,
  longitude: lng,
  status: 'active',
  confirmation_count: 1,
  expires_at: new Date(Date.now() + 3600e3).toISOString(),
});

afterEach(() => localStorage.clear());

describe('voice guidance phrases', () => {
  it.each([
    [35, '40 metres'],
    [240, '250 metres'],
    [980, '1 kilometre'],
    [1600, '1.5 kilometres'],
  ])('%d m -> %s', (m, s) => expect(spokenDistance(m)).toBe(s));

  it('announces a maneuver once per stage, from far to near', () => {
    const spoken = new Set();
    const say = (p) => {
      const a = nextAnnouncement(p, spoken);
      a?.keys.forEach((k) => spoken.add(k));
      return a?.text ?? null;
    };
    expect(say(at(3.1))).toBeNull(); // 2.2 km away: too early
    expect(say(at(3.1111))).toBe('In 1 kilometre, turn right onto Jalan Tun Razak.');
    expect(say(at(3.113))).toBeNull(); // already said
    expect(say(at(3.118))).toBe('In 200 metres, turn right onto Jalan Tun Razak.');
    expect(say(at(3.1198))).toBe('Turn right onto Jalan Tun Razak.');
    expect(say(at(3.1198))).toBeNull();
  });

  it('skips farther stages when a maneuver first appears up close', () => {
    const spoken = new Set();
    const first = nextAnnouncement(at(3.118), spoken);
    expect(first.text).toMatch(/^In 200 metres/);
    expect(first.keys).toEqual(['1:far', '1:near']);
  });

  it('announces arrival once', () => {
    const spoken = new Set(['arrived']);
    const arrived = at(3.12, 101.7059);
    expect(arrived.arrived).toBe(true);
    expect(nextAnnouncement(arrived, new Set()).text).toBe('You have arrived at your destination.');
    expect(nextAnnouncement(arrived, spoken)).toBeNull();
  });
});

describe('community reports on the route', () => {
  const reports = [
    report('on-route', 3.115, 101.7001), // ~11 m from the road, 1.67 km along
    report('side-street', 3.115, 101.703), // ~330 m away: not on the route
    report('behind', 3.101, 101.7), // near the start
    report('far-away', 3.3, 101.9),
  ];

  it('keeps only reports close to the route line, ordered along it', () => {
    const onRoute = reportsAlongRoute(prepared, reports);
    expect(onRoute.map((r) => r.report.id)).toEqual(['behind', 'on-route']);
  });

  it('lists only reports ahead and within the lookahead', () => {
    const onRoute = reportsAlongRoute(prepared, reports);
    const ahead = upcomingReports(onRoute, at(3.105).distanceAlong);
    expect(ahead.map((r) => r.report.id)).toEqual(['on-route']);
    expect(ahead[0].distanceAhead).toBeCloseTo(1112, -1);
    expect(upcomingReports(onRoute, at(3.1).distanceAlong, 1000).map((r) => r.report.id)).toEqual(['behind']);
  });
});

describe('useGuidance', () => {
  const setup = (props) => {
    const speak = vi.fn();
    const hook = renderHook((p) => useGuidance({ speak, active: true, prepared, rerouting: false, reports: [], ...p }), {
      initialProps: props,
    });
    return { speak, ...hook };
  };

  it('speaks turn instructions as the driver approaches', () => {
    const { speak, rerender } = setup({ progress: at(3.1) });
    expect(speak).not.toHaveBeenCalled();
    rerender({ progress: at(3.1111) });
    expect(speak).toHaveBeenLastCalledWith('In 1 kilometre, turn right onto Jalan Tun Razak.', { urgent: false });
    rerender({ progress: at(3.1198) });
    expect(speak).toHaveBeenLastCalledWith('Turn right onto Jalan Tun Razak.', { urgent: true });
  });

  it('alerts once about an incident ahead and exposes it for the banner', () => {
    const reports = [report('r1', 3.115, 101.7001, 'police')];
    const { speak, result, rerender } = setup({ progress: at(3.1), reports });
    // 1.67 km ahead: inside the 2 km banner window, too far for a spoken alert.
    expect(result.current.reportAhead.report.id).toBe('r1');
    expect(result.current.reportAhead.distanceAhead).toBeCloseTo(1668, -1);
    expect(speak).not.toHaveBeenCalled();

    rerender({ progress: at(3.108), reports });
    expect(speak).toHaveBeenCalledWith('Police checkpoint reported ahead, in 800 metres.', undefined);
    rerender({ progress: at(3.109), reports });
    expect(speak.mock.calls.filter(([t]) => t.includes('reported ahead'))).toHaveLength(1);

    // Passed it: no longer shown.
    rerender({ progress: at(3.116), reports });
    expect(result.current.reportAhead).toBeNull();
  });

  it('stays quiet when muted, and remembers the choice', () => {
    const { speak, result, rerender } = setup({ progress: at(3.1) });
    act(() => result.current.toggleVoice());
    expect(result.current.voiceOn).toBe(false);
    expect(localStorage.getItem('lesgo.voice')).toBe('off');
    rerender({ progress: at(3.112) });
    expect(speak).not.toHaveBeenCalled();
  });

  it('announces a completed reroute', () => {
    const { speak, rerender } = setup({ progress: null, rerouting: true });
    rerender({ progress: null, rerouting: false });
    expect(speak).toHaveBeenCalledWith('Route recalculated.', undefined);
  });
});

describe('useWakeLock', () => {
  function fakeWakeLock() {
    const sentinel = { release: vi.fn(async () => {}), addEventListener: vi.fn() };
    return { sentinel, request: vi.fn(async () => sentinel) };
  }

  it('holds a screen wake lock while navigating and releases it afterwards', async () => {
    const wakeLock = fakeWakeLock();
    const { result, rerender } = renderHook(({ active }) => useWakeLock(active, { wakeLock }), { initialProps: { active: true } });
    await act(async () => {});
    expect(wakeLock.request).toHaveBeenCalledWith('screen');
    expect(result.current.held).toBe(true);
    rerender({ active: false });
    expect(wakeLock.sentinel.release).toHaveBeenCalled();
    expect(result.current.held).toBe(false);
  });

  it('does nothing where the API is unsupported', () => {
    const { result } = renderHook(() => useWakeLock(true, { wakeLock: undefined }));
    expect(result.current).toEqual({ supported: false, held: false });
  });

  it('survives a denied request', async () => {
    const wakeLock = { request: vi.fn(async () => Promise.reject(new Error('NotAllowedError'))) };
    const { result } = renderHook(() => useWakeLock(true, { wakeLock }));
    await act(async () => {});
    expect(result.current.held).toBe(false);
  });
});

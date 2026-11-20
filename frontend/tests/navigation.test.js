import { describe, expect, it } from 'vitest';
import { computeProgress, prepareRoute } from '../src/navigation/navigationEngine.js';
import { boundsToBbox, haversine, locateOnLine } from '../src/utils/geo.js';
import { formatDistance, formatDuration, formatSpeed, timeAgo } from '../src/utils/format.js';

// An L-shaped route: ~1.1 km north, then ~0.7 km east.
const route = {
  distance: 1800,
  duration: 240,
  geometry: [
    [52.5, 13.4],
    [52.505, 13.4],
    [52.51, 13.4],
    [52.51, 13.405],
    [52.51, 13.41],
  ],
  steps: [
    { instruction: 'Head north', type: 'depart', location: [52.5, 13.4], distance: 1112 },
    { instruction: 'Turn right onto East St', type: 'turn', modifier: 'right', location: [52.51, 13.4], distance: 679 },
    { instruction: 'Arrive at your destination', type: 'arrive', location: [52.51, 13.41], distance: 0 },
  ],
};

describe('navigation engine', () => {
  const prepared = prepareRoute(route);

  it('places maneuvers along the route', () => {
    expect(prepared.steps[0].along).toBe(0);
    expect(prepared.steps[1].along).toBeCloseTo(1112, -1);
    expect(prepared.steps[2].along).toBeCloseTo(prepared.total, 0);
  });

  it('computes next turn, distance to it, remaining distance and ETA', () => {
    const now = Date.UTC(2025, 0, 1, 12, 0, 0);
    const p = computeProgress(prepared, { lat: 52.505, lng: 13.4, accuracy: 5 }, null, now);
    expect(p.nextStep.instruction).toBe('Turn right onto East St');
    expect(p.distanceToNextStep).toBeCloseTo(556, -1);
    expect(p.remainingDistance).toBeCloseTo(prepared.total - 556, -1);
    expect(p.remainingDuration).toBeCloseTo(240 * (p.remainingDistance / prepared.total), 5);
    expect(p.eta.getTime()).toBeCloseTo(now + p.remainingDuration * 1000, -1);
    expect(p.offRoute).toBe(false);
    expect(p.arrived).toBe(false);
  });

  it('moves to the following maneuver after the turn', () => {
    const p = computeProgress(prepared, { lat: 52.51, lng: 13.403, accuracy: 5 });
    expect(p.nextStep.type).toBe('arrive');
    expect(p.followingStep).toBeNull();
  });

  it('detects leaving the route', () => {
    const p = computeProgress(prepared, { lat: 52.505, lng: 13.403, accuracy: 10 }); // ~200 m east of the road
    expect(p.offRoute).toBe(true);
  });

  it('allows for poor GPS accuracy before calling off-route', () => {
    const p = computeProgress(prepared, { lat: 52.505, lng: 13.401, accuracy: 80 }); // ~68 m off, ±80 m
    expect(p.offRoute).toBe(false);
  });

  it('detects arrival', () => {
    const p = computeProgress(prepared, { lat: 52.51, lng: 13.4098, accuracy: 5 });
    expect(p.arrived).toBe(true);
  });
});

describe('geo utilities', () => {
  it('measures distance', () => {
    expect(haversine([52.5, 13.4], [52.51, 13.4])).toBeCloseTo(1112, -1);
  });

  it('snaps a point onto a line', () => {
    const m = locateOnLine([52.507, 13.4001], route.geometry);
    expect(m.distance).toBeLessThan(10);
    expect(m.index).toBe(1);
  });

  it('builds a padded bbox string', () => {
    const bounds = { getSouthWest: () => ({ lat: 52, lng: 13 }), getNorthEast: () => ({ lat: 53, lng: 14 }) };
    expect(boundsToBbox(bounds, 0)).toBe('13.00000,52.00000,14.00000,53.00000');
  });
});

describe('formatting', () => {
  it.each([
    [42, '40 m'],
    [950, '950 m'],
    [1234, '1.2 km'],
    [25400, '25 km'],
  ])('distance %d -> %s', (m, s) => expect(formatDistance(m)).toBe(s));

  it.each([
    [30, '<1 min'],
    [600, '10 min'],
    [3900, '1 h 5 min'],
    [7200, '2 h'],
  ])('duration %d -> %s', (sec, s) => expect(formatDuration(sec)).toBe(s));

  it('converts speed to km/h and handles missing values', () => {
    expect(formatSpeed(13.9)).toBe(50);
    expect(formatSpeed(null)).toBeNull();
  });

  it('formats relative times', () => {
    const now = Date.UTC(2025, 0, 1, 12);
    expect(timeAgo(new Date(now - 20_000), now)).toBe('just now');
    expect(timeAgo(new Date(now - 5 * 60_000), now)).toBe('5 min ago');
    expect(timeAgo(new Date(now - 3 * 3600_000), now)).toBe('3 h ago');
  });
});

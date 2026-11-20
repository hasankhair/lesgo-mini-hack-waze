import { cumulativeDistances, haversine, locateOnLine } from '../utils/geo.js';

export const OFF_ROUTE_METERS = 50;
export const ARRIVAL_METERS = 30;

// Precomputes distances along the route and where each maneuver sits on it.
export function prepareRoute(route) {
  const line = route.geometry;
  const cumulative = cumulativeDistances(line);
  const total = cumulative.at(-1) || route.distance || 0;
  let searchFrom = 0;
  const steps = route.steps.map((step) => {
    const at = locateOnLine(step.location, line, cumulative, searchFrom);
    searchFrom = at.index;
    return { ...step, along: at.along };
  });
  return { route, line, cumulative, total, steps };
}

// Computes live navigation state for a GPS position.
// `previous` is the last progress object, used to keep progress monotonic.
export function computeProgress(prepared, position, previous = null, now = Date.now()) {
  const { line, cumulative, total, steps, route } = prepared;
  const here = [position.lat, position.lng];

  // Search near the previous match first; fall back to the whole line if the
  // driver has clearly left that part of the route.
  let match = locateOnLine(here, line, cumulative, Math.max(0, (previous?.segmentIndex ?? 0) - 3));
  if (match.distance > OFF_ROUTE_METERS * 2) {
    const global = locateOnLine(here, line, cumulative, 0);
    if (global.distance < match.distance) match = global;
  }

  const along = Math.min(total, match.along);
  const remainingDistance = Math.max(0, total - along);
  const tolerance = Math.max(OFF_ROUTE_METERS, (position.accuracy || 0) * 1.5);
  const offRoute = match.distance > tolerance;
  const arrived = remainingDistance <= ARRIVAL_METERS || haversine(here, line.at(-1)) <= ARRIVAL_METERS;

  // Next maneuver: first step ahead of the current position (skip "depart").
  let nextIndex = steps.findIndex((s, i) => i > 0 && s.along > along + 5);
  if (nextIndex === -1) nextIndex = steps.length - 1;
  const nextStep = steps[nextIndex];
  const followingStep = steps[nextIndex + 1] ?? null;

  const fraction = total > 0 ? remainingDistance / total : 0;
  const remainingDuration = route.duration * fraction;

  return {
    segmentIndex: match.index,
    snapped: match.point,
    distanceFromRoute: match.distance,
    distanceAlong: along,
    remainingDistance,
    remainingDuration,
    eta: new Date(now + remainingDuration * 1000),
    nextStepIndex: nextIndex,
    nextStep,
    followingStep,
    distanceToNextStep: Math.max(0, nextStep.along - along),
    offRoute,
    arrived,
  };
}

import { locateOnLine } from '../utils/geo.js';

// A report counts as "on the route" if it is within this distance of the line.
export const ON_ROUTE_METERS = 40;
// Only warn about reports this far ahead or closer.
export const LOOKAHEAD_METERS = 2000;
// Speak an alert once a report is this close.
export const ALERT_METERS = 1000;

// Finds reports lying on the route and where they are along it. Run when the
// route or the report list changes, not on every GPS update.
export function reportsAlongRoute(prepared, reports, maxOffset = ON_ROUTE_METERS) {
  if (!prepared || !reports?.length) return [];
  const { line, cumulative } = prepared;

  // Cheap bounding-box filter before the per-segment projection.
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of line) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const pad = 0.001; // ~110 m

  const found = [];
  for (const report of reports) {
    const { latitude: lat, longitude: lng } = report;
    if (lat < minLat - pad || lat > maxLat + pad || lng < minLng - pad || lng > maxLng + pad) continue;
    const match = locateOnLine([lat, lng], line, cumulative);
    if (match.distance <= maxOffset) found.push({ report, along: match.along });
  }
  return found.sort((a, b) => a.along - b.along);
}

// Reports ahead of the driver within the lookahead window, nearest first.
export function upcomingReports(onRoute, distanceAlong, lookahead = LOOKAHEAD_METERS) {
  return onRoute
    .map((r) => ({ ...r, distanceAhead: r.along - distanceAlong }))
    .filter((r) => r.distanceAhead > 0 && r.distanceAhead <= lookahead);
}


// Geometry helpers. Points are [lat, lng] arrays or {lat, lng} objects.

const R = 6371008.8; // mean Earth radius in metres
const rad = (d) => (d * Math.PI) / 180;

export const toPair = (p) => (Array.isArray(p) ? p : [p.lat, p.lng]);

export function haversine(a, b) {
  const [lat1, lng1] = toPair(a);
  const [lat2, lng2] = toPair(b);
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulativeDistances(line) {
  const out = [0];
  for (let i = 1; i < line.length; i += 1) out.push(out[i - 1] + haversine(line[i - 1], line[i]));
  return out;
}

// Projects point p onto segment a-b using a local equirectangular projection
// (accurate enough at street scale). Returns the fraction t along a-b and the
// distance in metres from p to the projected point.
export function projectOnSegment(p, a, b) {
  const [plat, plng] = toPair(p);
  const k = Math.cos(rad(plat));
  const ax = (a[1] - plng) * k;
  const ay = a[0] - plat;
  const bx = (b[1] - plng) * k;
  const by = b[0] - plat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, point, distance: haversine([plat, plng], point) };
}

// Finds where position p lies along a polyline. `fromIndex` limits the search
// to segments at or after a previous match, so progress does not jump
// backwards where a route passes near itself.
export function locateOnLine(p, line, cumulative = cumulativeDistances(line), fromIndex = 0) {
  let best = null;
  const start = Math.max(0, Math.min(fromIndex, line.length - 2));
  for (let i = start; i < line.length - 1; i += 1) {
    const proj = projectOnSegment(p, line[i], line[i + 1]);
    if (!best || proj.distance < best.distance) {
      const segLen = cumulative[i + 1] - cumulative[i];
      best = { index: i, point: proj.point, distance: proj.distance, along: cumulative[i] + segLen * proj.t };
    }
  }
  return best ?? { index: 0, point: line[0], distance: haversine(p, line[0]), along: 0 };
}

export function boundsToBbox(bounds, pad = 0.1) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const dLat = (ne.lat - sw.lat) * pad;
  const dLng = (ne.lng - sw.lng) * pad;
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
  return [
    clamp(sw.lng - dLng, 180),
    clamp(sw.lat - dLat, 90),
    clamp(ne.lng + dLng, 180),
    clamp(ne.lat + dLat, 90),
  ]
    .map((n) => n.toFixed(5))
    .join(',');
}

// Initial compass bearing from a to b, in degrees clockwise from north (0–360).
export function bearingBetween(a, b) {
  const [lat1, lng1] = toPair(a).map(rad);
  const [lat2, lng2] = toPair(b).map(rad);
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

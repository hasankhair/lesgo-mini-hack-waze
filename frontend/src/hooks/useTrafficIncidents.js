import { useEffect, useMemo, useState } from 'react';
import { listTrafficIncidents as defaultList } from '../services/trafficService.js';

// TomTom's incident API accepts boxes up to 10,000 km². Stay under that.
const MAX_KM2 = 9000;
const REFRESH_MS = 2 * 60 * 1000;

const parse = (bbox) => {
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  return { minLng, minLat, maxLng, maxLat };
};

const areaKm2 = ({ minLng, minLat, maxLng, maxLat }) =>
  (maxLat - minLat) * 111.32 * (maxLng - minLng) * 111.32 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

// Shrinks a bbox around its centre until it fits the API's area limit.
export function clampBbox(bbox) {
  const b = parse(bbox);
  const area = areaKm2(b);
  if (area <= MAX_KM2) return bbox;
  const k = Math.sqrt(MAX_KM2 / area);
  const cLat = (b.minLat + b.maxLat) / 2;
  const cLng = (b.minLng + b.maxLng) / 2;
  const hLat = ((b.maxLat - b.minLat) / 2) * k;
  const hLng = ((b.maxLng - b.minLng) / 2) * k;
  return [cLng - hLng, cLat - hLat, cLng + hLng, cLat + hLat].map((n) => n.toFixed(4)).join(',');
}

// Bounding box string for a route line, padded slightly.
export function routeBbox(line) {
  if (!line?.length) return null;
  let [minLat, minLng] = line[0];
  let [maxLat, maxLng] = line[0];
  for (const [lat, lng] of line) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  const pad = 0.005;
  return [minLng - pad, minLat - pad, maxLng + pad, maxLat + pad].map((n) => n.toFixed(4)).join(',');
}

// Official traffic incidents for an area, refreshed every two minutes.
export function useTrafficIncidents({ bbox, enabled, list = defaultList, refreshMs = REFRESH_MS }) {
  const [incidents, setIncidents] = useState([]);
  const [tick, setTick] = useState(0);
  const area = useMemo(() => (enabled && bbox ? clampBbox(bbox) : null), [enabled, bbox]);

  useEffect(() => {
    if (!area) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [area, refreshMs]);

  useEffect(() => {
    if (!area) {
      setIncidents([]);
      return undefined;
    }
    const controller = new AbortController();
    list(area, { signal: controller.signal })
      .then(setIncidents)
      .catch(() => {
        // Keep showing the last known incidents if a refresh fails.
      });
    return () => controller.abort();
  }, [area, tick, list]);

  return incidents;
}

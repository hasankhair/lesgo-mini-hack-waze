import { HttpError } from '../../utils/httpError.js';

// TomTom Traffic Incidents API adapter
// (https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details).
// Official incident data: accidents, closures, roadworks, jams and hazards.

// TomTom iconCategory -> Lesgo category (reuses the community report icons).
const CATEGORIES = {
  0: ['other', 'Incident'],
  1: ['accident', 'Accident'],
  2: ['hazard', 'Fog'],
  3: ['hazard', 'Dangerous conditions'],
  4: ['hazard', 'Rain'],
  5: ['hazard', 'Ice'],
  6: ['traffic_jam', 'Traffic jam'],
  7: ['roadblock', 'Lane closed'],
  8: ['roadblock', 'Road closed'],
  9: ['construction', 'Roadworks'],
  10: ['hazard', 'Strong wind'],
  11: ['flood', 'Flooding'],
  14: ['breakdown', 'Broken-down vehicle'],
};

const SEVERITY = ['unknown', 'minor', 'moderate', 'major', 'undefined'];

// The API rejects boxes larger than 10,000 km².
export const MAX_BBOX_KM2 = 10000;

export function bboxAreaKm2({ minLat, maxLat, minLng, maxLng }) {
  const kmPerDegLat = 111.32;
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  return (maxLat - minLat) * kmPerDegLat * (maxLng - minLng) * kmPerDegLat * Math.cos(midLat);
}

const FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';

// Keeps at most `max` points of a line, always including both ends.
function thin(coords, max = 40) {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]);
}

export function normalizeIncident(feature) {
  const p = feature.properties ?? {};
  const g = feature.geometry ?? {};
  const raw = g.type === 'Point' ? [g.coordinates] : g.coordinates ?? [];
  const line = thin(raw).map(([lng, lat]) => [lat, lng]);
  if (!line.length) return null;
  const [category, label] = CATEGORIES[p.iconCategory] ?? CATEGORIES[0];
  const description = (p.events ?? []).map((e) => e.description).filter(Boolean).join('; ');
  return {
    id: p.id,
    category,
    label,
    description: description || label,
    severity: SEVERITY[p.magnitudeOfDelay] ?? 'unknown',
    from: p.from || null,
    to: p.to || null,
    delaySeconds: Number.isFinite(p.delay) ? p.delay : null,
    lengthMeters: Number.isFinite(p.length) ? Math.round(p.length) : null,
    roadNumbers: p.roadNumbers ?? [],
    startTime: p.startTime || null,
    endTime: p.endTime || null,
    // Where the incident begins, in the direction of travel.
    latitude: line[0][0],
    longitude: line[0][1],
    geometry: line,
  };
}

export function createTomTomTrafficProvider({ baseUrl = 'https://api.tomtom.com', apiKey, fetchJson }) {
  if (!apiKey) throw new Error('TRAFFIC_PROVIDER=tomtom requires TOMTOM_API_KEY');
  const base = baseUrl.replace(/\/$/, '');

  return {
    name: 'tomtom',
    available: true,
    attribution: 'Traffic data © TomTom',

    async getIncidents({ bbox }) {
      if (bboxAreaKm2(bbox) > MAX_BBOX_KM2) {
        throw new HttpError(400, 'Area too large for traffic incidents. Zoom in.', { code: 'AREA_TOO_LARGE' });
      }
      const params = new URLSearchParams({
        key: apiKey,
        bbox: [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].join(','),
        fields: FIELDS,
        language: 'en-GB',
        timeValidityFilter: 'present',
      });
      const { data } = await fetchJson(`${base}/traffic/services/5/incidentDetails?${params}`);
      return (data?.incidents ?? []).map(normalizeIncident).filter(Boolean);
    },
  };
}

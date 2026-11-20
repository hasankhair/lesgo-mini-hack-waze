import { HttpError } from '../../utils/httpError.js';

// openrouteservice adapter (https://openrouteservice.org). Requires an API key
// (ORS_API_KEY). Supports true shortest-route search and toll avoidance. Like
// OSRM it does not use live traffic data.

// ORS instruction type codes -> maneuver type/modifier used by the frontend.
const STEP_TYPES = {
  0: ['turn', 'left'],
  1: ['turn', 'right'],
  2: ['turn', 'sharp left'],
  3: ['turn', 'sharp right'],
  4: ['turn', 'slight left'],
  5: ['turn', 'slight right'],
  6: ['continue', 'straight'],
  7: ['roundabout', null],
  8: ['exit roundabout', null],
  9: ['turn', 'uturn'],
  10: ['arrive', null],
  11: ['depart', null],
  12: ['fork', 'slight left'],
  13: ['fork', 'slight right'],
};

const toLatLng = ([lng, lat]) => [lat, lng];

function mapFeature(feature, index) {
  const coords = feature.geometry.coordinates;
  const { summary = {}, segments = [] } = feature.properties;
  const steps = segments.flatMap((segment) =>
    segment.steps.map((step) => {
      const [type, modifier] = STEP_TYPES[step.type] || ['continue', null];
      return {
        instruction: step.instruction,
        name: step.name && step.name !== '-' ? step.name : '',
        distance: step.distance,
        duration: step.duration,
        type,
        modifier,
        location: toLatLng(coords[step.way_points[0]]),
      };
    }),
  );
  return {
    id: `ors-${index}`,
    distance: summary.distance ?? 0,
    duration: summary.duration ?? 0,
    summary: '',
    geometry: coords.map(toLatLng),
    steps,
  };
}

export function createOpenRouteServiceRouter({ baseUrl, apiKey, fetchJson }) {
  if (!apiKey) throw new Error('ROUTING_PROVIDER=openrouteservice requires ORS_API_KEY');
  const base = baseUrl.replace(/\/$/, '');

  return {
    name: 'openrouteservice',
    capabilities: {
      trafficAware: false,
      supportsAvoidTolls: true,
      shortestIsApproximate: false,
      maxAlternatives: 3,
    },

    async route({ origin, destination, preference, avoidTolls }) {
      const body = {
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        preference: preference === 'shortest' ? 'shortest' : 'fastest',
        instructions: true,
        units: 'm',
        // ORS only computes alternatives for routes up to ~100 km.
        alternative_routes: { target_count: 3, weight_factor: 1.4, share_factor: 0.6 },
        ...(avoidTolls ? { options: { avoid_features: ['tollways'] } } : {}),
      };
      const { status, data } = await fetchJson(`${base}/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: { Authorization: apiKey },
        body,
        allowStatuses: [400, 404],
      });
      if (status === 404 || data?.error?.code === 2010 || data?.error?.code === 2009) {
        throw new HttpError(404, 'No drivable route was found between these points.', { code: 'NO_ROUTE' });
      }
      if (status >= 400) {
        // Long routes fail with alternatives enabled; retry without them.
        if (body.alternative_routes) {
          delete body.alternative_routes;
          const retry = await fetchJson(`${base}/v2/directions/driving-car/geojson`, {
            method: 'POST',
            headers: { Authorization: apiKey },
            body,
          });
          return (retry.data?.features || []).map(mapFeature);
        }
        throw new HttpError(502, 'The routing service returned an error.', { code: 'UPSTREAM_ERROR' });
      }
      return (data?.features || []).map(mapFeature);
    },
  };
}

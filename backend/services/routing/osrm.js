import { HttpError } from '../../utils/httpError.js';
import { osrmInstruction } from './instructions.js';

// OSRM adapter (https://project-osrm.org). OSRM routes on static road data
// with typical speeds: it has no live traffic, and it optimises for duration
// only. "Shortest" is therefore approximated by picking the shortest of the
// candidate routes OSRM returns. The public demo server
// (router.project-osrm.org) is for light development use only, has no SLA and
// rejects exclude=toll.

const toLatLng = ([lng, lat]) => [lat, lng];

function mapRoute(route, index) {
  const steps = route.legs.flatMap((leg) =>
    leg.steps.map((step) => ({
      instruction: osrmInstruction(step),
      name: step.name || step.ref || '',
      distance: step.distance,
      duration: step.duration,
      type: step.maneuver.type,
      modifier: step.maneuver.modifier || null,
      location: toLatLng(step.maneuver.location),
    })),
  );
  return {
    id: `osrm-${index}`,
    distance: route.distance,
    duration: route.duration,
    summary: route.legs.map((l) => l.summary).filter(Boolean).join(', '),
    geometry: route.geometry.coordinates.map(toLatLng),
    steps,
  };
}

export function createOsrmRouter({ baseUrl, supportsExclude, fetchJson }) {
  const base = baseUrl.replace(/\/$/, '');

  return {
    name: 'osrm',
    capabilities: {
      trafficAware: false,
      supportsAvoidTolls: supportsExclude,
      // Approximated from alternatives, not a true shortest-path search.
      shortestIsApproximate: true,
      maxAlternatives: 3,
    },

    async route({ origin, destination, avoidTolls }) {
      const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const params = new URLSearchParams({
        overview: 'full',
        geometries: 'geojson',
        steps: 'true',
        alternatives: '3',
      });
      if (avoidTolls && supportsExclude) params.set('exclude', 'toll');

      const { data } = await fetchJson(`${base}/route/v1/driving/${coords}?${params}`, { allowStatuses: [400] });
      if (data?.code === 'NoRoute' || data?.code === 'NoSegment') {
        throw new HttpError(404, 'No drivable route was found between these points.', { code: 'NO_ROUTE' });
      }
      if (data?.code !== 'Ok') {
        throw new HttpError(502, data?.message || 'The routing service returned an error.', { code: 'UPSTREAM_ERROR' });
      }
      return data.routes.map(mapRoute);
    },
  };
}

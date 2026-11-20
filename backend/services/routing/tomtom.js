import { HttpError } from '../../utils/httpError.js';

// TomTom Routing API adapter (https://developer.tomtom.com/routing-api).
// Routes and travel times include live traffic. Supports true shortest
// routes and toll avoidance. Requires TOMTOM_API_KEY.

// TomTom maneuver codes -> the maneuver type/modifier used by the frontend.
const MANEUVERS = {
  DEPART: ['depart', null],
  ARRIVE: ['arrive', null],
  ARRIVE_LEFT: ['arrive', 'left'],
  ARRIVE_RIGHT: ['arrive', 'right'],
  STRAIGHT: ['continue', 'straight'],
  FOLLOW: ['continue', 'straight'],
  KEEP_RIGHT: ['fork', 'slight right'],
  KEEP_LEFT: ['fork', 'slight left'],
  BEAR_RIGHT: ['turn', 'slight right'],
  BEAR_LEFT: ['turn', 'slight left'],
  TURN_RIGHT: ['turn', 'right'],
  TURN_LEFT: ['turn', 'left'],
  SHARP_RIGHT: ['turn', 'sharp right'],
  SHARP_LEFT: ['turn', 'sharp left'],
  MAKE_UTURN: ['turn', 'uturn'],
  TRY_MAKE_UTURN: ['turn', 'uturn'],
  ENTER_MOTORWAY: ['on ramp', null],
  ENTER_FREEWAY: ['on ramp', null],
  ENTER_HIGHWAY: ['on ramp', null],
  ENTRANCE_RAMP: ['on ramp', null],
  TAKE_EXIT: ['off ramp', null],
  MOTORWAY_EXIT_LEFT: ['off ramp', 'slight left'],
  MOTORWAY_EXIT_RIGHT: ['off ramp', 'slight right'],
  ROUNDABOUT_CROSS: ['roundabout', 'straight'],
  ROUNDABOUT_RIGHT: ['roundabout', 'right'],
  ROUNDABOUT_LEFT: ['roundabout', 'left'],
  ROUNDABOUT_BACK: ['roundabout', 'uturn'],
  SWITCH_PARALLEL_ROAD: ['continue', null],
  SWITCH_MAIN_ROAD: ['continue', null],
  TAKE_FERRY: ['continue', null],
};

const toLatLng = (p) => [p.latitude, p.longitude];

function mapRoute(route, index) {
  const geometry = route.legs.flatMap((leg, i) => (i === 0 ? leg.points : leg.points.slice(1)).map(toLatLng));
  const instructions = route.guidance?.instructions ?? [];
  const steps = instructions.map((ins, i) => {
    const [type, modifier] = MANEUVERS[ins.maneuver] ?? ['continue', null];
    const next = instructions[i + 1];
    return {
      instruction: ins.message || ins.combinedMessage || 'Continue',
      name: ins.street || ins.roadNumbers?.[0] || '',
      distance: next ? next.routeOffsetInMeters - ins.routeOffsetInMeters : 0,
      duration: next ? next.travelTimeInSeconds - ins.travelTimeInSeconds : 0,
      type,
      modifier,
      location: toLatLng(ins.point),
    };
  });
  const s = route.summary;
  return {
    id: `tomtom-${index}`,
    distance: s.lengthInMeters,
    duration: s.travelTimeInSeconds,
    // Extra time caused by current traffic, compared with free-flowing roads.
    trafficDelay: s.trafficDelayInSeconds ?? 0,
    noTrafficDuration: s.noTrafficTravelTimeInSeconds ?? null,
    summary: [...new Set(steps.map((st) => st.name).filter(Boolean))].slice(1, 3).join(', '),
    geometry,
    steps,
  };
}

export function createTomTomRouter({ baseUrl = 'https://api.tomtom.com', apiKey, fetchJson }) {
  if (!apiKey) throw new Error('ROUTING_PROVIDER=tomtom requires TOMTOM_API_KEY');
  const base = baseUrl.replace(/\/$/, '');

  return {
    name: 'tomtom',
    capabilities: {
      trafficAware: true,
      supportsAvoidTolls: true,
      shortestIsApproximate: false,
      maxAlternatives: 2,
    },

    async route({ origin, destination, preference, avoidTolls }) {
      const locations = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
      const params = new URLSearchParams({
        key: apiKey,
        traffic: 'true',
        travelMode: 'car',
        routeType: preference === 'shortest' ? 'shortest' : 'fastest',
        maxAlternatives: '2',
        instructionsType: 'text',
        language: 'en-GB',
        routeRepresentation: 'polyline',
        computeTravelTimeFor: 'all',
      });
      if (avoidTolls) params.set('avoid', 'tollRoads');

      const { status, data } = await fetchJson(`${base}/routing/1/calculateRoute/${locations}/json?${params}`, {
        allowStatuses: [400, 404],
      });
      if (status === 400 || status === 404) {
        // e.g. {"detailedError":{"code":"NO_ROUTE_FOUND","message":"... No valid route found"}}
        const code = data?.detailedError?.code || '';
        const msg = data?.detailedError?.message || data?.error?.description || '';
        if (status === 404 || /NO_ROUTE|UNREACHABLE/i.test(code) || /no (valid )?route/i.test(msg)) {
          throw new HttpError(404, 'No drivable route was found between these points.', { code: 'NO_ROUTE' });
        }
        throw new HttpError(502, 'The routing service rejected the request.', { code: 'UPSTREAM_ERROR' });
      }
      if (!data?.routes?.length) {
        throw new HttpError(404, 'No drivable route was found between these points.', { code: 'NO_ROUTE' });
      }
      return data.routes.map(mapRoute);
    },
  };
}

import { createOsrmRouter } from './osrm.js';
import { createOpenRouteServiceRouter } from './openrouteservice.js';

// Router adapter contract:
//   name: string
//   capabilities: { trafficAware, supportsAvoidTolls, shortestIsApproximate, maxAlternatives }
//   route({ origin, destination, preference, avoidTolls }) -> Route[]
// Route: { id, distance (m), duration (s), summary, geometry: [lat,lng][], steps: Step[] }
// Step:  { instruction, name, distance, duration, type, modifier, location: [lat,lng] }
export function createRouter(config, fetchJson) {
  switch (config.routing.provider) {
    case 'osrm':
      return createOsrmRouter({
        baseUrl: config.routing.osrmUrl,
        supportsExclude: config.routing.osrmSupportsExclude,
        fetchJson,
      });
    case 'openrouteservice':
      return createOpenRouteServiceRouter({
        baseUrl: config.routing.orsUrl,
        apiKey: config.routing.orsApiKey,
        fetchJson,
      });
    default:
      throw new Error(`Unknown ROUTING_PROVIDER "${config.routing.provider}"`);
  }
}

// Orders candidate routes for the requested preference. The first route is
// the recommended one; the rest are alternatives.
export function rankRoutes(routes, preference) {
  const key = preference === 'shortest' ? 'distance' : 'duration';
  return [...routes].sort((a, b) => a[key] - b[key]);
}

export async function planRoutes(router, { origin, destination, preference = 'fastest', avoidTolls = false }) {
  const { capabilities } = router;
  const warnings = [];
  const tollsApplied = avoidTolls && capabilities.supportsAvoidTolls;

  if (avoidTolls && !capabilities.supportsAvoidTolls) {
    warnings.push('The current routing provider cannot avoid toll roads. These routes may include tolls.');
  }
  if (preference === 'shortest' && capabilities.shortestIsApproximate) {
    warnings.push('Shortest route is chosen from the available candidate routes and may not be the absolute shortest path.');
  }
  if (!capabilities.trafficAware) {
    warnings.push('Travel times are based on typical road speeds, not live traffic.');
  }

  const routes = await router.route({ origin, destination, preference, avoidTolls: tollsApplied });
  const ranked = rankRoutes(routes, preference).map((route, index) => ({
    ...route,
    id: `route-${index}`,
    recommended: index === 0,
  }));

  return {
    provider: router.name,
    trafficAware: capabilities.trafficAware,
    appliedPreferences: { preference, avoidTolls: tollsApplied },
    warnings,
    routes: ranked,
  };
}

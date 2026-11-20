import { cached } from '../services/cache.js';
import { planRoutes } from '../services/routing/index.js';

const round = (n, digits) => Number(n.toFixed(digits));

// Geocoding, routing, traffic and capability endpoints. These only proxy to
// the configured providers; no user data is stored.
export function createMapsController({ geocoder, router, traffic, geocodeCache, routeCache, communityAvailable = false }) {
  return {
    capabilities(_req, res) {
      res.json({
        geocoding: { provider: geocoder.name, supportsAutocomplete: geocoder.supportsAutocomplete },
        routing: { provider: router.name, ...router.capabilities },
        traffic: { provider: traffic.name, available: traffic.available },
        // Community reports and accounts need Supabase.
        community: { available: communityAvailable },
      });
    },

    async search(req, res) {
      const { q, lat, lng, limit, lang } = req.valid.query;
      // Round the bias point (~1 km) for cache hits and to avoid forwarding precise locations.
      const near = lat !== undefined && lng !== undefined ? { lat: round(lat, 2), lng: round(lng, 2) } : undefined;
      const key = JSON.stringify(['s', q.toLowerCase(), near, limit, lang]);
      const results = await cached(geocodeCache, key, () => geocoder.search({ query: q, near, limit, lang }));
      res.json({ results, provider: geocoder.name });
    },

    async reverse(req, res) {
      const lat = round(req.valid.query.lat, 5);
      const lng = round(req.valid.query.lng, 5);
      const place = await cached(geocodeCache, JSON.stringify(['r', lat, lng]), () => geocoder.reverse({ lat, lng }));
      res.json({ result: place, provider: geocoder.name });
    },

    async route(req, res) {
      const body = req.valid.body;
      const r5 = (p) => ({ lat: round(p.lat, 5), lng: round(p.lng, 5) });
      const params = { ...body, origin: r5(body.origin), destination: r5(body.destination) };
      const result = await cached(routeCache, JSON.stringify(params), () => planRoutes(router, params));
      res.json(result);
    },

    async trafficFlow(req, res) {
      const flow = await traffic.getFlow({ bbox: req.valid.query.bbox });
      res.json({ available: traffic.available, provider: traffic.name, ...flow });
    },
  };
}

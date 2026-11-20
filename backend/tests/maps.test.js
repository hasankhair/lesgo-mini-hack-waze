import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './helpers.js';
import { createPhotonGeocoder } from '../services/geocoding/photon.js';
import { createNominatimGeocoder } from '../services/geocoding/nominatim.js';
import { createOsrmRouter } from '../services/routing/osrm.js';
import { createOpenRouteServiceRouter } from '../services/routing/openrouteservice.js';
import { planRoutes, rankRoutes } from '../services/routing/index.js';
import { osrmInstruction } from '../services/routing/instructions.js';
import { createHttpClient } from '../services/http.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('destination search', () => {
  it('normalises Photon results', async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, data: fixture('photon-search.json') }));
    const geocoder = createPhotonGeocoder({ baseUrl: 'https://photon.test', fetchJson });
    const results = await geocoder.search({ query: 'berlin hauptbahnhof', near: { lat: 52.5, lng: 13.4 } });

    expect(fetchJson.mock.calls[0][0]).toMatch(/^https:\/\/photon\.test\/api\/\?q=berlin\+hauptbahnhof&limit=6&lat=52\.5&lon=13\.4/);
    expect(results[0]).toMatchObject({ name: 'Berlin Hauptbahnhof', lat: 52.5249451, lng: 13.3696614 });
    expect(results[0].label).toContain('Berlin');
    expect(results[0].id).toMatch(/^photon:/);
  });

  it('throttles Nominatim and disables autocomplete', async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, data: [{ place_id: 1, osm_type: 'node', osm_id: 5, lat: '1.5', lon: '2.5', display_name: 'Fuel, Town', type: 'fuel' }] }));
    const geocoder = createNominatimGeocoder({ baseUrl: 'https://nominatim.test', fetchJson, minIntervalMs: 50 });
    expect(geocoder.supportsAutocomplete).toBe(false);
    const started = Date.now();
    await geocoder.search({ query: 'fuel' });
    const [result] = await geocoder.search({ query: 'fuel' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    expect(result).toMatchObject({ lat: 1.5, lng: 2.5, category: 'petrol_station', name: 'Fuel' });
  });

  it('serves search through the API with validation and caching', async () => {
    const geocoder = { name: 'fake', supportsAutocomplete: true, search: vi.fn(async () => [{ id: 'a', name: 'Mall' }]) };
    const app = buildApp({ geocoder, supabase: null });

    expect((await request(app).get('/api/geocode/search?q=a')).status).toBe(400);
    const first = await request(app).get('/api/geocode/search?q=Mall&lat=52.123456&lng=13.987654');
    await request(app).get('/api/geocode/search?q=mall&lat=52.12&lng=13.99');
    expect(first.status).toBe(200);
    expect(first.body.results).toEqual([{ id: 'a', name: 'Mall' }]);
    expect(geocoder.search).toHaveBeenCalledTimes(1);
    // The bias location is coarsened before it leaves the server.
    expect(geocoder.search.mock.calls[0][0].near).toEqual({ lat: 52.12, lng: 13.99 });
  });

  it('returns an empty list when nothing matches', async () => {
    const geocoder = { name: 'fake', supportsAutocomplete: true, search: async () => [] };
    const res = await request(buildApp({ geocoder, supabase: null })).get('/api/geocode/search?q=zzzzzz');
    expect(res.body.results).toEqual([]);
  });
});

describe('route calculation', () => {
  it('maps OSRM responses to routes with turn instructions', async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, data: fixture('osrm-route.json') }));
    const router = createOsrmRouter({ baseUrl: 'https://osrm.test', supportsExclude: false, fetchJson });
    const [route] = await router.route({ origin: { lat: 52.517037, lng: 13.38886 }, destination: { lat: 52.529407, lng: 13.397634 } });

    expect(fetchJson.mock.calls[0][0]).toContain('/route/v1/driving/13.38886,52.517037;13.397634,52.529407?');
    expect(fetchJson.mock.calls[0][0]).not.toContain('exclude');
    expect(route.distance).toBeGreaterThan(1000);
    expect(route.geometry[0][0]).toBeCloseTo(52.517, 2); // [lat, lng] order
    expect(route.steps[0].instruction).toMatch(/^Head out|^Start/);
    expect(route.steps.at(-1).type).toBe('arrive');
  });

  it('requests toll avoidance only when the OSRM server supports it', async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, data: fixture('osrm-route.json') }));
    const router = createOsrmRouter({ baseUrl: 'https://osrm.test', supportsExclude: true, fetchJson });
    await router.route({ origin: { lat: 1, lng: 1 }, destination: { lat: 2, lng: 2 }, avoidTolls: true });
    expect(fetchJson.mock.calls[0][0]).toContain('exclude=toll');
  });

  it('reports "no route" as a 404', async () => {
    const fetchJson = async () => ({ status: 400, data: { code: 'NoRoute', message: 'Impossible route' } });
    const router = createOsrmRouter({ baseUrl: 'https://osrm.test', supportsExclude: false, fetchJson });
    await expect(router.route({ origin: { lat: 1, lng: 1 }, destination: { lat: 2, lng: 2 } })).rejects.toMatchObject({ status: 404, code: 'NO_ROUTE' });
  });

  it('ranks routes by duration or distance', () => {
    const routes = [
      { id: 'a', duration: 600, distance: 9000 },
      { id: 'b', duration: 700, distance: 7000 },
    ];
    expect(rankRoutes(routes, 'fastest').map((r) => r.id)).toEqual(['a', 'b']);
    expect(rankRoutes(routes, 'shortest').map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('is honest about missing traffic data and unsupported preferences', async () => {
    const router = {
      name: 'fake',
      capabilities: { trafficAware: false, supportsAvoidTolls: false, shortestIsApproximate: true },
      route: vi.fn(async () => [
        { id: 'x', duration: 100, distance: 2000, geometry: [], steps: [] },
        { id: 'y', duration: 120, distance: 1500, geometry: [], steps: [] },
      ]),
    };
    const plan = await planRoutes(router, { origin: { lat: 1, lng: 1 }, destination: { lat: 2, lng: 2 }, preference: 'shortest', avoidTolls: true });
    expect(plan.trafficAware).toBe(false);
    expect(plan.appliedPreferences).toEqual({ preference: 'shortest', avoidTolls: false });
    expect(plan.warnings.join(' ')).toMatch(/toll/);
    expect(plan.warnings.join(' ')).toMatch(/not live traffic/);
    expect(plan.routes.map((r) => [r.distance, r.recommended])).toEqual([[1500, true], [2000, false]]);
    expect(router.route.mock.calls[0][0].avoidTolls).toBe(false);
  });

  it('maps openrouteservice responses and sends preferences', async () => {
    const fetchJson = vi.fn(async () => ({
      status: 200,
      data: {
        features: [
          {
            geometry: { coordinates: [[13.1, 52.1], [13.2, 52.2], [13.3, 52.3]] },
            properties: {
              summary: { distance: 2500, duration: 300 },
              segments: [{ steps: [
                { type: 11, instruction: 'Head north', name: 'A St', distance: 1000, duration: 100, way_points: [0, 1] },
                { type: 1, instruction: 'Turn right onto B St', name: 'B St', distance: 1500, duration: 200, way_points: [1, 2] },
                { type: 10, instruction: 'Arrive', name: '-', distance: 0, duration: 0, way_points: [2, 2] },
              ] }],
            },
          },
        ],
      },
    }));
    const router = createOpenRouteServiceRouter({ baseUrl: 'https://ors.test', apiKey: 'k', fetchJson });
    const [route] = await router.route({ origin: { lat: 52.1, lng: 13.1 }, destination: { lat: 52.3, lng: 13.3 }, preference: 'shortest', avoidTolls: true });
    const body = fetchJson.mock.calls[0][1].body;
    expect(body.preference).toBe('shortest');
    expect(body.options.avoid_features).toEqual(['tollways']);
    expect(route.steps[1]).toMatchObject({ type: 'turn', modifier: 'right', location: [52.2, 13.2] });
    expect(route.steps[2].name).toBe('');
  });

  it('validates the route request body', async () => {
    const app = buildApp({ supabase: null });
    const res = await request(app).post('/api/routes').send({ origin: { lat: 200, lng: 0 }, destination: { lat: 0, lng: 0 } });
    expect(res.status).toBe(400);
  });

  it('serves routes through the API', async () => {
    const router = {
      name: 'fake',
      capabilities: { trafficAware: false, supportsAvoidTolls: true, shortestIsApproximate: false },
      route: async () => [{ id: 'x', duration: 100, distance: 2000, geometry: [[1, 1], [2, 2]], steps: [] }],
    };
    const res = await request(buildApp({ router, supabase: null }))
      .post('/api/routes')
      .send({ origin: { lat: 1, lng: 1 }, destination: { lat: 2, lng: 2 } });
    expect(res.status).toBe(200);
    expect(res.body.routes[0]).toMatchObject({ id: 'route-0', recommended: true });
  });

  it('exposes provider capabilities', async () => {
    const res = await request(buildApp({ supabase: null })).get('/api/capabilities');
    expect(res.body).toMatchObject({
      geocoding: { provider: 'photon', supportsAutocomplete: true },
      routing: { provider: 'osrm', trafficAware: false, supportsAvoidTolls: false },
      traffic: { provider: 'none', available: false },
      community: { available: false },
    });
  });
});

describe('turn instructions', () => {
  it.each([
    [{ maneuver: { type: 'turn', modifier: 'left' }, name: 'Main St' }, 'Turn left onto Main St'],
    [{ maneuver: { type: 'roundabout', exit: 2 }, name: 'Ring Rd' }, 'At the roundabout, take the 2nd exit onto Ring Rd'],
    [{ maneuver: { type: 'arrive', modifier: 'right' } }, 'Arrive at your destination on the right'],
    [{ maneuver: { type: 'off ramp', modifier: 'slight right' }, destinations: 'A1: Hamburg' }, 'Take the exit on the right towards Hamburg'],
    [{ maneuver: { type: 'fork', modifier: 'slight left' }, ref: 'A9' }, 'Keep left at the fork onto A9'],
  ])('%j -> %s', (step, text) => {
    expect(osrmInstruction(step)).toBe(text);
  });
});

describe('upstream HTTP client', () => {
  it('turns timeouts and upstream throttling into friendly errors', async () => {
    const timeout = createHttpClient({ userAgent: 'x', timeoutMs: 10, fetchImpl: async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; } });
    await expect(timeout('https://x.test')).rejects.toMatchObject({ status: 504 });
    const busy = createHttpClient({ userAgent: 'x', timeoutMs: 10, fetchImpl: async () => new Response('{}', { status: 429 }) });
    await expect(busy('https://x.test')).rejects.toMatchObject({ status: 503 });
  });

  it('sends the configured User-Agent', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const fetchJson = createHttpClient({ userAgent: 'Lesgo/test', timeoutMs: 1000, fetchImpl });
    await fetchJson('https://x.test');
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toBe('Lesgo/test');
  });
});

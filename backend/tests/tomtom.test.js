import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './helpers.js';
import { createTomTomRouter } from '../services/routing/tomtom.js';
import { createTomTomTrafficProvider, bboxAreaKm2, normalizeIncident } from '../services/traffic/tomtom.js';
import { planRoutes } from '../services/routing/index.js';
import { loadConfig } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const KL = { origin: { lat: 3.1579, lng: 101.7116 }, destination: { lat: 3.139, lng: 101.6869 } };

describe('TomTom routing', () => {
  const ok = () => vi.fn(async () => ({ status: 200, data: fixture('tomtom-route.json') }));

  it('requests traffic-aware routes with the chosen preferences', async () => {
    const fetchJson = ok();
    const router = createTomTomRouter({ apiKey: 'k', fetchJson });
    await router.route({ ...KL, preference: 'shortest', avoidTolls: true });
    const url = new URL(fetchJson.mock.calls[0][0]);
    expect(url.pathname).toBe('/routing/1/calculateRoute/3.1579,101.7116:3.139,101.6869/json');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: 'k',
      traffic: 'true',
      routeType: 'shortest',
      avoid: 'tollRoads',
      maxAlternatives: '2',
    });
  });

  it('omits toll avoidance unless asked', async () => {
    const fetchJson = ok();
    await createTomTomRouter({ apiKey: 'k', fetchJson }).route({ ...KL, preference: 'fastest' });
    expect(new URL(fetchJson.mock.calls[0][0]).searchParams.has('avoid')).toBe(false);
  });

  it('maps routes, live-traffic times and turn instructions', async () => {
    const routes = await createTomTomRouter({ apiKey: 'k', fetchJson: ok() }).route(KL);
    expect(routes).toHaveLength(3);
    const [first] = routes;
    expect(first).toMatchObject({ distance: 8446, duration: 1075, trafficDelay: 115, noTrafficDuration: 603 });
    expect(first.geometry[0]).toEqual([expect.closeTo(3.158, 2), expect.closeTo(101.712, 2)]); // [lat, lng]
    expect(first.steps[0]).toMatchObject({ type: 'depart', instruction: expect.stringMatching(/^Leave from/) });
    expect(first.steps[1]).toMatchObject({ type: 'on ramp', instruction: 'Take the E12 motorway', distance: expect.any(Number) });
    expect(first.steps.at(-1).type).toBe('arrive');
    // Step distances add up to the route length.
    const sum = first.steps.reduce((t, s) => t + s.distance, 0);
    expect(sum).toBeCloseTo(first.distance, -1);
  });

  it('reports "no route" as a 404', async () => {
    // Real TomTom response for Kuala Lumpur -> Sydney.
    const fetchJson = async () => ({
      status: 400,
      data: { formatVersion: '0.0.12', detailedError: { message: 'Engine error while executing route request: NO_ROUTE_FOUND: No valid route found', code: 'NO_ROUTE_FOUND' } },
    });
    await expect(createTomTomRouter({ apiKey: 'k', fetchJson }).route(KL)).rejects.toMatchObject({ status: 404, code: 'NO_ROUTE' });
  });

  it('requires an API key', () => {
    expect(() => createTomTomRouter({ apiKey: '', fetchJson: vi.fn() })).toThrow(/TOMTOM_API_KEY/);
  });

  it('does not add a "no live traffic" warning to traffic-aware plans', async () => {
    const plan = await planRoutes(createTomTomRouter({ apiKey: 'k', fetchJson: ok() }), { ...KL, avoidTolls: true });
    expect(plan.trafficAware).toBe(true);
    expect(plan.appliedPreferences.avoidTolls).toBe(true);
    expect(plan.warnings).toEqual([]);
    expect(plan.routes[0].recommended).toBe(true);
  });
});

describe('routing fallback', () => {
  const fallback = {
    name: 'osrm',
    capabilities: { trafficAware: false, supportsAvoidTolls: false, shortestIsApproximate: true },
    route: vi.fn(async () => [{ id: 'x', distance: 1000, duration: 100, geometry: [], steps: [] }]),
  };
  const failing = (err) => ({ name: 'tomtom', capabilities: { trafficAware: true, supportsAvoidTolls: true }, route: async () => Promise.reject(err) });

  it('uses the fallback when TomTom is down and says traffic is missing', async () => {
    const plan = await planRoutes(failing(new HttpError(503, 'busy')), KL, { fallback });
    expect(plan.provider).toBe('osrm');
    expect(plan.fallbackFrom).toBe('tomtom');
    expect(plan.trafficAware).toBe(false);
    expect(plan.warnings[0]).toMatch(/unavailable right now, so these routes don't include live traffic/);
  });

  it('does not fall back when there is genuinely no route', async () => {
    await expect(planRoutes(failing(new HttpError(404, 'none', { code: 'NO_ROUTE' })), KL, { fallback })).rejects.toMatchObject({ status: 404 });
  });
});

describe('TomTom traffic incidents', () => {
  const bbox = { minLng: 101.6, minLat: 3.08, maxLng: 101.75, maxLat: 3.2 };

  it('normalises incidents into Lesgo categories', async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, data: fixture('tomtom-incidents.json') }));
    const incidents = await createTomTomTrafficProvider({ apiKey: 'k', fetchJson }).getIncidents({ bbox });
    const url = new URL(fetchJson.mock.calls[0][0]);
    expect(url.searchParams.get('bbox')).toBe('101.6,3.08,101.75,3.2');
    expect(url.searchParams.get('timeValidityFilter')).toBe('present');

    const jam = incidents.find((i) => i.category === 'traffic_jam');
    expect(jam).toMatchObject({ label: 'Traffic jam', description: expect.any(String), latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(jam.geometry[0]).toEqual([jam.latitude, jam.longitude]);
    expect(incidents.map((i) => i.category)).toEqual(expect.arrayContaining(['traffic_jam', 'construction', 'roadblock']));
    expect(incidents.find((i) => i.category === 'construction').description).toBe('Roadworks');
  });

  it('thins long incident lines', () => {
    const coords = Array.from({ length: 500 }, (_, i) => [101 + i / 1000, 3]);
    const inc = normalizeIncident({ properties: { id: 'a', iconCategory: 6 }, geometry: { type: 'LineString', coordinates: coords } });
    expect(inc.geometry).toHaveLength(40);
    expect(inc.geometry.at(-1)).toEqual([3, 101.499]);
  });

  it('refuses areas larger than TomTom allows', async () => {
    expect(bboxAreaKm2({ minLat: 3, maxLat: 4, minLng: 101, maxLng: 102 })).toBeGreaterThan(10000);
    const provider = createTomTomTrafficProvider({ apiKey: 'k', fetchJson: vi.fn() });
    await expect(provider.getIncidents({ bbox: { minLat: 3, maxLat: 4, minLng: 101, maxLng: 102 } })).rejects.toMatchObject({ status: 400, code: 'AREA_TOO_LARGE' });
  });
});

describe('traffic API endpoints', () => {
  it('serves official incidents, labelled as such, with caching', async () => {
    const traffic = { name: 'tomtom', available: true, attribution: 'Traffic data © TomTom', getIncidents: vi.fn(async () => [{ id: 'i1' }]) };
    const app = buildApp({ traffic, supabase: null });
    const res = await request(app).get('/api/traffic/incidents?bbox=101.601,3.081,101.749,3.199');
    await request(app).get('/api/traffic/incidents?bbox=101.602,3.082,101.748,3.198');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: true, source: 'official', attribution: 'Traffic data © TomTom', incidents: [{ id: 'i1' }] });
    expect(traffic.getIncidents).toHaveBeenCalledTimes(1);
    expect(traffic.getIncidents.mock.calls[0][0].bbox).toEqual({ minLat: 3.08, minLng: 101.6, maxLat: 3.2, maxLng: 101.75 });
  });

  it('returns no incidents without a traffic provider', async () => {
    const res = await request(buildApp({ supabase: null })).get('/api/traffic/incidents?bbox=101.6,3.08,101.75,3.2');
    expect(res.body).toMatchObject({ available: false, incidents: [] });
  });

  it('switches to TomTom routing and traffic when a key is configured', () => {
    const config = loadConfig({ TOMTOM_API_KEY: 'k' });
    expect(config.routing.provider).toBe('tomtom');
    expect(config.routing.fallbackProvider).toBe('osrm');
    expect(config.traffic.provider).toBe('tomtom');
    expect(loadConfig({}).routing.provider).toBe('osrm');
  });

  it('reports traffic capabilities', async () => {
    const res = await request(buildApp({ supabase: null }, { TOMTOM_API_KEY: 'k' })).get('/api/capabilities');
    expect(res.body.routing).toMatchObject({ provider: 'tomtom', trafficAware: true, supportsAvoidTolls: true });
    expect(res.body.traffic).toMatchObject({ provider: 'tomtom', available: true, attribution: 'Traffic data © TomTom' });
  });
});

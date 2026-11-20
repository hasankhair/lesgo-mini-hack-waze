import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setAccessTokenProvider } from '../src/services/api.js';
import { planRoute, searchPlaces } from '../src/services/mapsService.js';
import { createReport, voteOnReport } from '../src/services/reportsService.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => setAccessTokenProvider(async () => null));

describe('API client', () => {
  it('requests routes with the chosen preferences', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { routes: [{ id: 'route-0' }], warnings: [] }));
    const plan = await planRoute({ origin: { lat: 1, lng: 2 }, destination: { lat: 3, lng: 4 }, preference: 'shortest', avoidTolls: true });
    expect(plan.routes[0].id).toBe('route-0');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/routes$/);
    expect(JSON.parse(init.body)).toEqual({ origin: { lat: 1, lng: 2 }, destination: { lat: 3, lng: 4 }, preference: 'shortest', avoidTolls: true });
  });

  it('passes the search term and bias location as query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { results: [] }));
    await searchPlaces('mall', { near: { lat: 1.5, lng: 2.5 } });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/geocode/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: 'mall', lat: '1.5', lng: '2.5' });
  });

  it('attaches the signed-in user’s access token', async () => {
    setAccessTokenProvider(async () => 'jwt-123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { report: { id: 'r1' } }));
    await createReport({ report_type: 'hazard', description: '', latitude: 1, longitude: 2 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-123');
  });

  it('turns API errors into ApiError with status and code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(403, { error: { code: 'OWN_REPORT', message: 'You cannot vote on your own report.' } }));
    const err = await voteOnReport('r1', 'confirm').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'OWN_REPORT', message: 'You cannot vote on your own report.' });
  });

  it('reports network failures clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(searchPlaces('x1')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp, createFakeSupabase, authHeader } from './helpers.js';

const protectedRoutes = [
  ['post', '/api/reports'],
  ['post', '/api/reports/22222222-2222-4222-8222-222222222222/votes'],
  ['delete', '/api/reports/22222222-2222-4222-8222-222222222222'],
  ['get', '/api/reports/mine'],
  ['get', '/api/profile'],
  ['patch', '/api/profile'],
  ['get', '/api/saved-locations'],
  ['post', '/api/saved-locations'],
  ['get', '/api/history'],
  ['post', '/api/history'],
];

describe('authentication protection', () => {
  it.each(protectedRoutes)('%s %s returns 401 without a token', async (method, path) => {
    const app = buildApp({ supabase: createFakeSupabase() });
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an invalid or expired token', async () => {
    const app = buildApp({ supabase: createFakeSupabase() });
    const res = await request(app).get('/api/profile').set('Authorization', 'Bearer forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('runs queries with a client scoped to the authenticated user', async () => {
    const supabase = createFakeSupabase({
      handle: () => ({ data: { id: 'x', username: 'alice' }, error: null }),
    });
    const res = await request(buildApp({ supabase })).get('/api/profile').set(authHeader);
    expect(res.status).toBe(200);
    expect(supabase.ops[0].client).toBe('user:11111111-1111-4111-8111-111111111111');
  });

  it('lets anonymous users browse reports', async () => {
    const supabase = createFakeSupabase();
    const res = await request(buildApp({ supabase })).get('/api/reports?bbox=13.3,52.4,13.5,52.6');
    expect(res.status).toBe(200);
    expect(supabase.ops[0].client).toBe('anon');
  });

  it('returns 503 for account features when Supabase is not configured', async () => {
    const app = buildApp({ supabase: null });
    const res = await request(app).get('/api/profile').set(authHeader);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SUPABASE_NOT_CONFIGURED');
  });
});

describe('app basics', () => {
  it('reports health', async () => {
    const res = await request(buildApp({ supabase: null })).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns JSON 404s for unknown routes', async () => {
    const res = await request(buildApp({ supabase: null })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON bodies', async () => {
    const res = await request(buildApp({ supabase: null }))
      .post('/api/routes')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers', async () => {
    const res = await request(buildApp({ supabase: null })).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

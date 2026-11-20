import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ALICE, authHeader, buildApp, createFakeSupabase } from './helpers.js';

const SAVED_ID = '33333333-3333-4333-8333-333333333333';

describe('saved locations', () => {
  it('lists the user’s saved places', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: [{ id: SAVED_ID, location_name: 'Gym' }], error: null }) });
    const res = await request(buildApp({ supabase })).get('/api/saved-locations').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
  });

  it('saves a favourite for the signed-in user', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: { id: SAVED_ID }, error: null }) });
    const res = await request(buildApp({ supabase }))
      .post('/api/saved-locations')
      .set(authHeader)
      .send({ location_name: ' Gym ', latitude: 52.5, longitude: 13.4 });
    expect(res.status).toBe(201);
    expect(supabase.ops).toHaveLength(1);
    expect(supabase.ops[0].payload).toMatchObject({ user_id: ALICE.id, location_name: 'Gym', category: 'favorite' });
  });

  it('replaces the existing Home when saving a new one', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: { id: SAVED_ID }, error: null }) });
    await request(buildApp({ supabase }))
      .post('/api/saved-locations')
      .set(authHeader)
      .send({ location_name: 'Home', category: 'home', latitude: 52.5, longitude: 13.4 });
    expect(supabase.ops.map((op) => op.action)).toEqual(['delete', 'insert']);
    expect(supabase.ops[0].filters).toContainEqual(['eq', 'category', 'home']);
  });

  it('validates names and coordinates', async () => {
    const app = buildApp({ supabase: createFakeSupabase() });
    expect((await request(app).post('/api/saved-locations').set(authHeader).send({ location_name: '', latitude: 1, longitude: 1 })).status).toBe(400);
    expect((await request(app).post('/api/saved-locations').set(authHeader).send({ location_name: 'X', latitude: 'north', longitude: 1 })).status).toBe(400);
    expect((await request(app).post('/api/saved-locations').set(authHeader).send({ location_name: 'X', category: 'secret', latitude: 1, longitude: 1 })).status).toBe(400);
  });

  it('returns 404 when deleting a place that is not visible to the user', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: [], error: null }) });
    const res = await request(buildApp({ supabase })).delete(`/api/saved-locations/${SAVED_ID}`).set(authHeader);
    expect(res.status).toBe(404);
  });
});

describe('navigation history', () => {
  const trip = {
    origin: { label: 'Current location', lat: 52.520008, lng: 13.404954 },
    destination: { label: 'Berlin Hbf', lat: 52.5249, lng: 13.3696 },
    distance: 3200,
    duration: 540,
  };

  it('stores trips with a coarsened origin', async () => {
    const supabase = createFakeSupabase({
      handle: (op) => (op.table === 'profiles' ? { data: { save_history: true }, error: null } : { data: { id: 'h1' }, error: null }),
    });
    const res = await request(buildApp({ supabase })).post('/api/history').set(authHeader).send(trip);
    expect(res.status).toBe(201);
    const insert = supabase.ops.find((op) => op.action === 'insert');
    expect(insert.payload).toMatchObject({ origin_latitude: 52.52, origin_longitude: 13.405, destination_label: 'Berlin Hbf' });
  });

  it('does not store trips when the user turned history off', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: { save_history: false }, error: null }) });
    const res = await request(buildApp({ supabase })).post('/api/history').set(authHeader).send(trip);
    expect(res.body.saved).toBe(false);
    expect(supabase.ops.some((op) => op.action === 'insert')).toBe(false);
  });
});

describe('profile', () => {
  it('reports a taken username as 409', async () => {
    const supabase = createFakeSupabase({ handle: () => ({ data: null, error: { code: '23505', message: 'dup' } }) });
    const res = await request(buildApp({ supabase })).patch('/api/profile').set(authHeader).send({ username: 'bob' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects non-https avatar URLs and empty patches', async () => {
    const app = buildApp({ supabase: createFakeSupabase() });
    expect((await request(app).patch('/api/profile').set(authHeader).send({ avatar_url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await request(app).patch('/api/profile').set(authHeader).send({})).status).toBe(400);
  });
});
